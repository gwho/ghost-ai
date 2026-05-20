/**
 * Redirects users to the editor when authenticated, or to sign-in otherwise.
 *
 * @returns Nothing because this route always redirects.
 */
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export default async function Home() {
  const { userId } = await auth()
  if (userId) redirect("/editor")
  redirect(process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? "/sign-in")
}
