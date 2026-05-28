import { Lock } from 'lucide-react'
import Link from 'next/link'

export function AccessDenied() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4">
      <Lock className="h-10 w-10 text-copy-muted" />
      <p className="text-base font-semibold text-copy-primary">Access denied</p>
      <p className="text-sm text-copy-muted text-center max-w-sm">
        This project doesn&apos;t exist or you don&apos;t have permission to view it.
      </p>
      <Link href="/editor" className="text-sm text-brand hover:underline">
        Back to editor
      </Link>
    </div>
  )
}
