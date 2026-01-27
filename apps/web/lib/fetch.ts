import { withRetry, withTimeout } from "@domainstack/safe-fetch";

const DEFAULT_USER_AGENT =
  process.env.EXTERNAL_USER_AGENT ||
  "domainstack.io/0.1 (+https://domainstack.io)";

/**
 * Options for fetch with timeout and retry behavior.
 */
export interface FetchOptions {
  /** Abort timeout per request (ms). Default: 5000 */
  timeoutMs?: number;
  /** Number of retry attempts (defaults to 0). */
  retries?: number;
  /** Base backoff delay for retries (ms). Default: 150. Uses exponential backoff. */
  backoffMs?: number;
}

/**
 * Fetch a trusted upstream resource with a timeout and optional retries.
 *
 * Uses exponential backoff for retries (delay * 2^attempt).
 *
 * Do not use this for user-controlled URLs; use `safeFetch` from @domainstack/safe-fetch instead.
 *
 * @example
 * ```ts
 * const response = await fetchWithTimeoutAndRetry(
 *   "https://api.example.com/data",
 *   { headers: { Authorization: "Bearer token" } },
 *   { timeoutMs: 5000, retries: 2 }
 * );
 * ```
 */
export async function fetchWithTimeoutAndRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  opts: FetchOptions = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 5000;
  const retries = Math.max(0, opts.retries ?? 0);
  const delayMs = Math.max(0, opts.backoffMs ?? 150);

  return withRetry(
    () => {
      const headers = new Headers(init.headers ?? undefined);
      headers.set("User-Agent", DEFAULT_USER_AGENT);

      return withTimeout(
        (signal: AbortSignal) =>
          fetch(input, {
            ...init,
            signal,
            headers,
          }),
        timeoutMs,
      );
    },
    {
      retries,
      delayMs,
    },
  );
}
