/**
 * Run an async operation with a timeout.
 *
 * @param fn - Function that receives an AbortSignal
 * @param timeoutMs - Timeout in milliseconds
 * @throws When the operation times out
 */
export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return fn(AbortSignal.timeout(timeoutMs));
}

/**
 * Retry an async operation with exponential backoff.
 *
 * @param fn - Function to retry
 * @param options - Retry options
 * @throws The last error if all retries are exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    /** Max retry attempts (default: 3) */
    retries?: number;
    /** Base delay in ms (default: 100) */
    delayMs?: number;
    /** Abort signal to cancel retries */
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const { retries = 3, delayMs = 100, signal } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) {
      throw new Error("Aborted");
    }

    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(delayMs * 2 ** attempt, signal);
      }
    }
  }

  throw lastError;
}

/**
 * Sleep for a given duration.
 *
 * @param ms - Duration in milliseconds
 * @param signal - Optional abort signal to cancel sleep
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }

    const timeoutId = setTimeout(resolve, ms);

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeoutId);
        reject(new Error("Aborted"));
      },
      { once: true },
    );
  });
}
