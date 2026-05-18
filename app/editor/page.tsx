/**
 * Page component that renders a full-height, centered container with a placeholder for the canvas.
 *
 * @returns The React element containing a centered paragraph with the text "Canvas goes here".
 */
export default function EditorPage() {
  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-copy-muted text-sm">Canvas goes here</p>
    </div>
  )
}
