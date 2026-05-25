"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

/**
 * Render a tab list container with the component's default styling.
 *
 * @param className - Additional CSS class name(s) to append to the base styles
 * @returns A React element for the tab list with the provided classes merged into the component's base styling
 */
function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-xl bg-muted p-1 text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

/**
 * Render a tab trigger element styled with the component's default classes.
 *
 * @param className - Additional class names appended to the default styles.
 * @returns The tab trigger element with merged class names.
 */
function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-xl px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
        className
      )}
      {...props}
    />
  )
}

/**
 * Render the content area for a tab with consistent base styling.
 *
 * Accepts the same props as the underlying tabs content element and merges an optional `className`.
 *
 * @returns The tab content element with top margin and focus-visible ring styling applied.
 */
function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn(
        "mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
