export class AsyncTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AsyncTimeoutError'
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(
      () => reject(new AsyncTimeoutError(message)),
      timeoutMs,
    )

    promise
      .then(resolve, reject)
      .finally(() => clearTimeout(timeoutId))
  })
}
