import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Compose and merge Tailwind CSS class names from multiple inputs.
 *
 * Flattens and normalizes clsx-compatible inputs (strings, arrays, objects, etc.)
 * and resolves conflicting Tailwind utilities into a single class string.
 *
 * @param inputs - One or more class name inputs compatible with `clsx`
 * @returns A single merged class string with Tailwind utility conflicts resolved
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
