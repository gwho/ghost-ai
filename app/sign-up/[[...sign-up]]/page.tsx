import { SignUp } from "@clerk/nextjs"
import { Cpu, Share2, FileText } from "lucide-react"

const features = [
  {
    icon: Cpu,
    title: "AI Architecture Generation",
    description: "Describe your system, AI maps it to nodes and edges on a live canvas.",
  },
  {
    icon: Share2,
    title: "Real-time Collaboration",
    description: "Live cursors, presence indicators, and shared node editing across your team.",
  },
  {
    icon: FileText,
    title: "Instant Spec Generation",
    description: "Export a complete Markdown technical spec directly from the canvas graph.",
  },
]

export default function SignUpPage() {
  return (
    <main className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden md:flex md:w-1/2 flex-col bg-surface border-r border-surface-border px-14 py-10">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-brand flex-shrink-0" />
          <span className="text-sm font-semibold text-copy-primary tracking-wide">Ghost AI</span>
        </div>

        {/* Headline + features */}
        <div className="flex-1 flex flex-col justify-center">
          <h1 className="text-4xl font-bold text-copy-primary leading-tight">
            Design systems at the<br />speed of thought.
          </h1>
          <p className="mt-5 text-base text-copy-secondary leading-relaxed max-w-sm">
            Describe your architecture in plain English. Ghost AI maps it to a shared canvas your whole team can refine in real time.
          </p>

          <ul className="mt-10 space-y-7">
            {features.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-brand-dim flex items-center justify-center">
                  <Icon className="h-4 w-4 text-brand" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-copy-primary">{title}</p>
                  <p className="text-sm text-copy-muted mt-0.5">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="text-xs text-copy-faint">
          © {new Date().getFullYear()} Ghost AI. All rights reserved.
        </p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 md:w-1/2 items-center justify-center px-6 bg-base">
        <SignUp />
      </div>
    </main>
  )
}
