import { USER_AGENT } from "@/lib/constants/app";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "fetch" });

/**
 * Options for fetch with timeout and retry behavior.
 */
export type FetchOptions = {
  /** Abort timeout per request (ms). */
  timeoutMs?: number;
  /** Number of retry attempts (defaults to 0). */
  retries?: number;
  /** Backoff delay multiplier for retries (ms). */
  backoffMs?: number;
};

/**
 * Fetch a trusted upstream resource with a timeout and optional retries.
 * Do not use this for user-controlled URLs; prefer the hardened remote asset helper.
 */
export async function fetchWithTimeoutAndRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  opts: FetchOptions = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 5000;
  const retries = Math.max(0, opts.retries ?? 0);
  const backoffMs = Math.max(0, opts.backoffMs ?? 150);
  const externalSignal = init.signal ?? undefined;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { signal, cleanup } = createAbortSignal(timeoutMs, externalSignal);
    try {
      // Robust header merging that handles Headers instances, objects, and undefined
      const headers = new Headers(init.headers ?? undefined);
      headers.set("User-Agent", USER_AGENT);

      const res = await fetch(input, {
        ...init,
        signal,
        headers,
      });
      cleanup();

      return res;
    } catch (err) {
      lastError = err;
      cleanup();

      // Don't retry if external signal was aborted
      if (externalSignal?.aborted) {
        throw err instanceof Error ? err : new Error("fetch aborted");
      }

      if (attempt < retries) {
        logger.warn(
          { err, url: input instanceof Request ? input.url : String(input) },
          `fetch failed, retrying (attempt ${attempt + 1}/${retries + 1})`,
        );
        // Simple linear backoff — good enough for trusted upstream retry logic.
        await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("fetch failed");
}

/**
 * Check if an error is a TLS/SSL related error from fetch/undici.
 */
export function isExpectedTlsError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const anyErr = err as unknown as {
    cause?: { code?: string; message?: string };
    code?: string;
    message?: string;
  };
  const code = anyErr?.cause?.code || anyErr?.code;
  const message = (
    anyErr?.cause?.message ||
    anyErr?.message ||
    ""
  ).toLowerCase();

  return (
    code === "ERR_TLS_CERT_ALTNAME_INVALID" ||
    code === "ERR_TLS_CERT_HAS_EXPIRED" ||
    code === "CERT_HAS_EXPIRED" ||
    code === "ERR_SSL_PROTOCOL_ERROR" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    code === "ERR_SSL_WRONG_VERSION_NUMBER" ||
    message.includes("certificate") ||
    message.includes("tls") ||
    message.includes("ssl") ||
    message.includes("signed")
  );
}

function createAbortSignal(
  timeoutMs: number,
  externalSignal?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  const cleanupFns: Array<() => void> = [() => clearTimeout(timeoutId)];

  const runCleanup = () => {
    for (const fn of cleanupFns) {
      try {
        fn();
      } catch (err) {
        // Ignore cleanup errors to ensure all cleanup functions run
        logger.error(err);
      }
    }
  };

  if (!externalSignal) {
    return {
      signal: timeoutController.signal,
      cleanup: runCleanup,
    };
  }

  const abortSignalAny = (
    AbortSignal as typeof AbortSignal & {
      any?: (signals: AbortSignal[]) => AbortSignal;
    }
  ).any;

  if (typeof abortSignalAny === "function") {
    return {
      signal: abortSignalAny([externalSignal, timeoutController.signal]),
      cleanup: runCleanup,
    };
  }

  const combinedController = new AbortController();
  const abortCombined = (reason?: unknown) => {
    if (!combinedController.signal.aborted) {
      try {
        // biome-ignore lint/suspicious/noExplicitAny: not critical
        combinedController.abort(reason as any);
      } catch {
        combinedController.abort();
      }
    }
  };

  const onExternalAbort = () =>
    abortCombined((externalSignal as { reason?: unknown }).reason);
  const onTimeoutAbort = () =>
    abortCombined((timeoutController.signal as { reason?: unknown }).reason);

  // Wrap listener setup in try-finally to ensure cleanup always registered
  try {
    if (externalSignal.aborted) {
      onExternalAbort();
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
      // Register cleanup immediately after adding listener
      cleanupFns.push(() => {
        try {
          externalSignal.removeEventListener("abort", onExternalAbort);
        } catch {
          // Listener might already be removed by { once: true }
        }
      });
    }

    if (timeoutController.signal.aborted) {
      onTimeoutAbort();
    } else {
      timeoutController.signal.addEventListener("abort", onTimeoutAbort, {
        once: true,
      });
      // Register cleanup immediately after adding listener
      cleanupFns.push(() => {
        try {
          timeoutController.signal.removeEventListener("abort", onTimeoutAbort);
        } catch {
          // Listener might already be removed by { once: true }
        }
      });
    }
  } catch (err) {
    // If any error occurs during setup, run cleanup immediately
    runCleanup();
    throw err;
  }

  return {
    signal: combinedController.signal,
    cleanup: runCleanup,
  };
}
