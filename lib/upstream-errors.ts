export function isTransientUpstreamError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ''
  return (
    message.includes('Failed to connect to upstream database') ||
    message.includes('Server has closed the connection') ||
    message.includes('Failed to connect') ||
    message.includes("Can't reach database") ||
    message.includes('Connection timed out')
  )
}
