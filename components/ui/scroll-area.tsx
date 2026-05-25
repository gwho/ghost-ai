"use client"

import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"
import { cn } from "@/lib/utils"

/**
 * Render a styled scroll area that composes Radix ScrollArea primitives and includes a viewport, scrollbar, and corner.
 *
 * @param className - Additional CSS classes to merge with the component's default `"relative overflow-hidden"` classes.
 * @param children - Content to be rendered inside the scroll viewport.
 * @param props - Additional props forwarded to `ScrollAreaPrimitive.Root`.
 * @returns A React element representing the composed scroll area.
 */
function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  return (
    <ScrollAreaPrimitive.Root
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

/**
 * Renders a styled scrollbar for a Radix ScrollArea, supporting vertical and horizontal orientations.
 *
 * @param className - Optional additional CSS classes to apply to the scrollbar container.
 * @param orientation - Scroll axis layout; `"vertical"` (default) uses full height and a left border, `"horizontal"` uses fixed height and a top border.
 * @returns A Radix `ScrollAreaScrollbar` element with a rounded `ScrollAreaThumb` and merged styling.
 */
function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      orientation={orientation}
      className={cn(
        "flex touch-none select-none transition-colors",
        orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent p-[1px]",
        orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent p-[1px]",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }
