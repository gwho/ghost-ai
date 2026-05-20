import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Renders a styled native `<textarea>` element.
 *
 * Accepts all standard `<textarea>` props, merges a fixed set of default classes with the optional
 * `className`, and forwards all other props to the underlying element.
 *
 * @param className - Additional CSS classes to append to the component's default styling
 * @returns The rendered `<textarea>` element with merged classes and forwarded props
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
