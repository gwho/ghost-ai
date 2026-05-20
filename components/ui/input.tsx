import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Renders a styled native `<input>` element with default layout and accessibility classes.
 *
 * @param className - Additional CSS classes to apply; they are merged with the component's default classes.
 * @param type - The input type attribute (e.g., `"text"`, `"email"`, `"password"`).
 * @returns The rendered `<input>` element.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
