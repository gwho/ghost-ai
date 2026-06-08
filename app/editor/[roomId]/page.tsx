import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { getProjectAccess } from '@/lib/project-access'
import { AccessDenied } from '@/components/editor/access-denied'
import { WorkspaceShell } from '@/components/editor/workspace-shell'
import { AsyncTimeoutError, withTimeout } from '@/lib/async-timeout'
import { isTransientUpstreamError } from '@/lib/upstream-errors'

interface Props {
  params: Promise<{ roomId: string }>
}

const WORKSPACE_ACCESS_TIMEOUT_MS = 5_000

export default async function WorkspacePage({ params }: Props) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { roomId } = await params
  let access
  try {
    access = await withTimeout(
      getProjectAccess(roomId),
      WORKSPACE_ACCESS_TIMEOUT_MS,
      'Timed out while verifying project access',
    )
  } catch (error) {
    if (!(error instanceof AsyncTimeoutError) && !isTransientUpstreamError(error)) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'Unable to verify project access'
    console.error('[workspace-page]', message)
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-base font-semibold text-copy-primary">
          Project is taking too long to load
        </p>
        <p className="max-w-sm text-sm text-copy-muted">
          The app could not verify project access quickly enough. Refresh to try again.
        </p>
      </div>
    )
  }

  if (!access) return <AccessDenied />

  return <WorkspaceShell project={access.project} isOwner={access.isOwner} />
}
