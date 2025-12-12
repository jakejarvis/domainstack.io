import { USER_AGENT } from "@/lib/constants/app";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "fetch" });

/**
 * Fetch a trusted upstream resource with a timeout and optional retries.
 * Do not use this for user-controlled URLs; prefer the hardened remote asset helper.
 */
export async function fetchWithTimeoutAndRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  opts: { timeoutMs?: number; retries?: number; backoffMs?: number } = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 5000;
  const retries = Math.max(0, opts.retries ?? 0);
  const backoffMs = Math.max(0, opts.backoffMs ?? 150);
  const externalSignal = init.signal ?? undefined;
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { signal, cleanup } = createAbortSignal(timeoutMs, externalSignal);
    try {
      const res = await fetch(input, {
        ...init,
        signal,
        headers: {
          "User-Agent": USER_AGENT,
          ...init.headers,
        },
      });
      cleanup();

      return res;
    } catch (err) {
      lastError = err;
      cleanup();
      if (externalSignal?.aborted) {
        throw err instanceof Error ? err : new Error("fetch aborted");
      }
      if (attempt < retries) {
        logger.warn(
          `fetch failed, retrying (attempt ${attempt + 1}/${retries})`,
          {
            url: input.toString(),
            error: err,
          },
        );
        // Simple linear backoff — good enough for trusted upstream retry logic.
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("fetch failed");
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
        logger.error("cleanup error", err);
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
