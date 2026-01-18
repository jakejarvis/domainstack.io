import "server-only";

// ============================================================================
// Timeout Utilities
// ============================================================================

/**
 * Options for timeout behavior.
 */
export interface TimeoutOptions {
  /** Timeout in milliseconds. */
  timeoutMs: number;
  /** Optional external abort signal to combine with timeout. */
  signal?: AbortSignal;
}

/**
 * Result of creating an abort signal with timeout.
 */
export interface TimeoutSignal {
  /** The combined abort signal (timeout + external). */
  signal: AbortSignal;
  /** Cleanup function to clear the timeout. Must be called when done. */
  cleanup: () => void;
}

/**
 * Create an abort signal that triggers after a timeout.
 *
 * If an external signal is provided, the returned signal will abort
 * when either the timeout expires OR the external signal aborts.
 *
 * @example
 * ```ts
 * const { signal, cleanup } = createTimeoutSignal({ timeoutMs: 5000 });
 * try {
 *   await fetch(url, { signal });
 * } finally {
 *   cleanup();
 * }
 * ```
 */
export function createTimeoutSignal(options: TimeoutOptions): TimeoutSignal {
  const { timeoutMs, signal: externalSignal } = options;

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  const cleanup = () => {
    clearTimeout(timeoutId);
  };

  if (!externalSignal) {
    return { signal: timeoutController.signal, cleanup };
  }

  // Try to use AbortSignal.any if available (Node 20+)
  const abortSignalAny = (
    AbortSignal as typeof AbortSignal & {
      any?: (signals: AbortSignal[]) => AbortSignal;
    }
  ).any;

  if (typeof abortSignalAny === "function") {
    return {
      signal: abortSignalAny([externalSignal, timeoutController.signal]),
      cleanup,
    };
  }

  // Fallback: manually combine signals
  const combinedController = new AbortController();

  const onAbort = () => {
    if (!combinedController.signal.aborted) {
      combinedController.abort();
    }
  };

  if (externalSignal.aborted) {
    onAbort();
  } else {
    externalSignal.addEventListener("abort", onAbort, { once: true });
  }

  timeoutController.signal.addEventListener("abort", onAbort, { once: true });

  return {
    signal: combinedController.signal,
    cleanup: () => {
      cleanup();
      externalSignal.removeEventListener("abort", onAbort);
      timeoutController.signal.removeEventListener("abort", onAbort);
    },
  };
}

/**
 * Wrap an async operation with a timeout.
 *
 * @param operation - Function that takes an AbortSignal and returns a promise
 * @param options - Timeout options
 * @returns The result of the operation
 * @throws If the operation times out or is aborted
 *
 * @example
 * ```ts
 * const result = await withTimeout(
 *   (signal) => fetch(url, { signal }),
 *   { timeoutMs: 5000 }
 * );
 * ```
 */
export async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: TimeoutOptions,
): Promise<T> {
  const { signal, cleanup } = createTimeoutSignal(options);
  try {
    return await operation(signal);
  } finally {
    cleanup();
  }
}

// ============================================================================
// Retry Utilities
// ============================================================================

/** Backoff type for retry delays. */
export type BackoffType = "constant" | "linear" | "exponential";

/**
 * Options for retry behavior.
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (0 = no retries, just one attempt). */
  retries?: number;
  /** Base delay between retries in milliseconds. */
  delayMs?: number;
  /**
   * Backoff type for delay calculation.
   * - "constant": Same delay each retry (delay)
   * - "linear": Delay increases linearly (delay, delay*2, delay*3, ...)
   * - "exponential": Delay increases exponentially using backoffMultiplier (delay * multiplier^attempt)
   * @default "constant"
   */
  backoffType?: BackoffType;
  /**
   * Backoff multiplier for exponential backoff.
   * Only used when backoffType is "exponential".
   * @default 2
   */
  backoffMultiplier?: number;
  /** Maximum delay between retries in milliseconds. */
  maxDelayMs?: number;
  /** Optional function to determine if an error is retryable. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Optional callback when a retry occurs. */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  /** Optional external abort signal to cancel retries. */
  signal?: AbortSignal;
}

/**
 * Default retry options.
 */
const DEFAULT_RETRY_OPTIONS: Required<
  Omit<RetryOptions, "signal" | "onRetry">
> = {
  retries: 0,
  delayMs: 150,
  backoffType: "constant",
  backoffMultiplier: 2,
  maxDelayMs: 30000,
  shouldRetry: () => true,
};

/**
 * Calculate delay for a given retry attempt.
 */
function calculateDelay(
  attempt: number,
  delayMs: number,
  backoffType: BackoffType,
  backoffMultiplier: number,
  maxDelayMs: number,
): number {
  let delay: number;
  switch (backoffType) {
    case "linear":
      // Linear: delay, delay*2, delay*3, ...
      delay = delayMs * (attempt + 1);
      break;
    case "exponential":
      // Exponential: delay, delay*multiplier, delay*multiplier^2, ...
      delay = delayMs * backoffMultiplier ** attempt;
      break;
    default:
      // Constant (default): same delay each time
      delay = delayMs;
      break;
  }
  return Math.min(delay, maxDelayMs);
}

/**
 * Wrap an async operation with retry logic.
 *
 * @param operation - Function to retry
 * @param options - Retry options
 * @returns The result of the operation
 * @throws The last error if all retries are exhausted
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => fetch(url),
 *   {
 *     retries: 3,
 *     delayMs: 1000,
 *     backoffType: "exponential",
 *     shouldRetry: (err) => err instanceof NetworkError,
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    retries,
    delayMs,
    backoffType,
    backoffMultiplier,
    maxDelayMs,
    shouldRetry,
  } = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    // Check if aborted before attempting
    if (options.signal?.aborted) {
      throw new Error("Operation aborted");
    }

    try {
      return await operation();
    } catch (err) {
      lastError = err;

      // Check if we should retry
      const isLastAttempt = attempt >= retries;
      if (isLastAttempt || !shouldRetry(err, attempt)) {
        throw err;
      }

      // Check if aborted before waiting
      if (options.signal?.aborted) {
        throw err;
      }

      // Calculate delay and wait
      const delay = calculateDelay(
        attempt,
        delayMs,
        backoffType,
        backoffMultiplier,
        maxDelayMs,
      );

      options.onRetry?.(err, attempt, delay);

      await sleep(delay, options.signal);
    }
  }

  throw lastError;
}

/**
 * Sleep for a given duration, optionally cancellable via AbortSignal.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Sleep aborted"));
      return;
    }

    let onAbort: (() => void) | undefined;

    const timeoutId = setTimeout(() => {
      // Clean up abort listener on normal completion to prevent memory leak
      if (signal && onAbort) {
        signal.removeEventListener("abort", onAbort);
      }
      resolve();
    }, ms);

    if (signal) {
      onAbort = () => {
        clearTimeout(timeoutId);
        reject(new Error("Sleep aborted"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

// ============================================================================
// Combined Utilities
// ============================================================================

/**
 * Options for operations with both timeout and retry.
 */
export interface TimeoutAndRetryOptions extends RetryOptions {
  /** Timeout per attempt in milliseconds. */
  timeoutMs?: number;
}

/**
 * Wrap an async operation with both timeout and retry logic.
 *
 * Each attempt has its own timeout. If an attempt times out, it counts
 * as a failed attempt and triggers a retry (if retries remain).
 *
 * @param operation - Function that takes an AbortSignal and returns a promise
 * @param options - Timeout and retry options
 * @returns The result of the operation
 *
 * @example
 * ```ts
 * const result = await withTimeoutAndRetry(
 *   (signal) => fetch(url, { signal }),
 *   {
 *     timeoutMs: 5000,
 *     retries: 3,
 *     delayMs: 1000,
 *   }
 * );
 * ```
 */
export async function withTimeoutAndRetry<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: TimeoutAndRetryOptions = {},
): Promise<T> {
  const { timeoutMs = 5000, ...retryOptions } = options;

  return withRetry(
    () => withTimeout(operation, { timeoutMs, signal: options.signal }),
    {
      ...retryOptions,
      onRetry: (err, attempt, delay) => {
        retryOptions.onRetry?.(err, attempt, delay);
      },
    },
  );
}
