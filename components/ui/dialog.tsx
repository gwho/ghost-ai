"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

/**
 * Render the dialog backdrop overlay with default backdrop styles and open/close animations.
 *
 * @param className - Additional CSS classes to merge with the component's default overlay classes
 * @param props - Additional props forwarded to the underlying Radix Overlay component
 * @returns The dialog overlay element with merged class names and animation states
 */
function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * Renders dialog content inside a portal, including a backdrop overlay and a built-in close button.
 *
 * @param className - Additional CSS classes merged with the component's default styling
 * @param children - Content to display inside the dialog
 * @returns The dialog content element wrapped in a portal with overlay and close control
 */
function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-elevated p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-xl opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

/**
 * Renders a dialog header container with responsive alignment and spacing.
 *
 * @param className - Additional CSS classes merged with the default header styles
 * @returns A `div` element configured as the dialog header
 */
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-1.5 text-center sm:text-left", className)} {...props} />
  )
}

/**
 * Layout container for a dialog footer that stacks controls vertically on small screens and aligns them to the right on larger screens.
 *
 * @param className - Additional class names to merge with the component's default layout styles.
 * @param props - Additional HTML attributes forwarded to the underlying `div`.
 * @returns The rendered footer `div` element.
 */
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

/**
 * Renders a Dialog title with consistent typography and optional custom classes.
 *
 * @param className - Additional class names to apply to the title element.
 * @returns A DialogPrimitive.Title element with default `text-lg font-semibold` styles combined with `className`.
 */
function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title className={cn("text-lg font-semibold", className)} {...props} />
  )
}

/**
 * Renders dialog descriptive text using the library's Description primitive with muted styling.
 *
 * @returns A `DialogPrimitive.Description` element with default muted typography (`text-sm text-muted-foreground`) combined with any provided `className` and forwarded props.
 */
function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
