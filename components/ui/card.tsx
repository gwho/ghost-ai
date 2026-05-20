import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Renders a container div styled as a card with configurable classes.
 *
 * Additional class names passed via `className` are merged with the component's default card classes,
 * and any other props are forwarded to the underlying `<div>`.
 *
 * @param className - Additional CSS class names to merge with the default card styles
 * @param props - Additional props to spread onto the underlying `<div>` element
 * @returns A `<div>` element styled as a card
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-2xl border border-border bg-card text-card-foreground", className)}
      {...props}
    />
  )
}

/**
 * Renders a card header container with default layout and padding classes.
 *
 * @param className - Additional class names to merge with the component's default classes
 * @returns A `div` element representing the card header
 */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />
}

/**
 * Renders an `h3` element styled as a card title using base typography classes and optional extra classes.
 *
 * @returns The rendered `<h3>` element with the combined class names.
 */
function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-lg font-semibold leading-none", className)} {...props} />
}

/**
 * Renders a paragraph element styled as a card description.
 *
 * The component applies base description styles and merges any provided `className`,
 * forwarding all other `<p>` props to the underlying element.
 *
 * @returns A `<p>` element with card description styling and forwarded props.
 */
function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />
}

/**
 * Renders the card's content container with default top padding removed and adjustable spacing.
 *
 * @param className - Additional class names to merge with the default padding classes (`p-6 pt-0`)
 * @returns A <div> element styled with `p-6 pt-0` merged with `className`; all other props are forwarded to the element
 */
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-6 pt-0", className)} {...props} />
}

/**
 * Renders the card's footer container with layout and padding for footer content.
 *
 * The component merges any provided `className` with the default footer classes.
 *
 * @param className - Optional additional CSS class names to append to the default footer styles
 * @returns A `div` element styled as the card footer
 */
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
