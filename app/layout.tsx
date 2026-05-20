import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { dark } from "@clerk/ui/themes"
import "./globals.css"

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  title: "Ghost AI",
  description: "Real-time collaborative system design workspace",
}

/**
 * Render the application's root HTML structure with a dark, full-height layout.
 *
 * Renders the top-level `<html>` and `<body>` elements and places `children` inside the body.
 *
 * @param children - React nodes to be rendered within the document body
 * @returns The root HTML element containing the provided `children`
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider
      appearance={{
        theme: dark,
        variables: {
          colorBackground: "var(--bg-base)",
          colorInput: "var(--bg-surface)",
          colorForeground: "var(--text-primary)",
          colorMutedForeground: "var(--text-secondary)",
          colorInputForeground: "var(--text-primary)",
          colorPrimary: "var(--accent-primary)",
          colorDanger: "var(--state-error)",
          borderRadius: "0.75rem",
        },
      }}
    >
      <html
        lang="en"
        className={`dark h-full antialiased ${geistSans.variable} ${geistMono.variable}`}
      >
        <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
