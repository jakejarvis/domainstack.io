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

    const onAbort = () => {
      clearTimeout(timeoutId);
      reject(new Error("Aborted"));
    };

    const timeoutId = setTimeout(() => {
      // Detach so repeated sleeps on one long-lived signal do not accumulate
      // listeners (Node warns past ten).
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
