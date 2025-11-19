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
      const res = await fetch(input, { ...init, signal });
      cleanup();
      return res;
    } catch (err) {
      lastError = err;
      cleanup();
      if (externalSignal?.aborted) {
        throw err instanceof Error ? err : new Error("fetch aborted");
      }
      if (attempt < retries) {
        // Simple linear backoff — good enough for trusted upstream retry logic.
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("fetch failed");
}

/**
 * Determines if a redirect should be followed based on selective redirect rules.
 * Allows redirects:
 * 1. Between apex/www versions (e.g., example.com -> www.example.com)
 * 2. Between http/https schemes
 * 3. To different paths on the same domain (e.g., www.example.com -> www.example.com/homepage)
 * 4. With different query parameters (e.g., example.com -> example.com/?ref=social)
 * 5. With different hash fragments (e.g., example.com -> example.com/#content)
 *
 * Blocks redirects:
 * - To different hostnames (after normalizing www)
 */
function isAllowedRedirect(fromUrl: string, toUrl: string): boolean {
  try {
    const from = new URL(fromUrl);
    const to = new URL(toUrl);

    // Normalize hostnames by removing www. prefix for comparison
    const normalizeHost = (host: string) => host.replace(/^www\./i, "");
    const fromHost = normalizeHost(from.hostname);
    const toHost = normalizeHost(to.hostname);

    // Must be the same hostname (after removing www). Subdomains remain blocked.
    if (fromHost !== toHost) {
      return false;
    }

    // Allow: same domain, any path, query params, or hash
    return true;
  } catch {
    // If URL parsing fails, don't allow redirect
    return false;
  }
}

/**
 * Fetch with manual redirect handling that only follows redirects to the same domain
 * (allowing apex/www, http/https, path, query param, and hash changes).
 */
export async function fetchWithSelectiveRedirects(
  input: RequestInfo | URL,
  init: RequestInit = {},
  opts: { timeoutMs?: number; maxRedirects?: number } = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 5000;
  const maxRedirects = opts.maxRedirects ?? 5;

  let currentUrl =
    typeof input === "string" || input instanceof URL
      ? input.toString()
      : input.url;
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        ...init,
        redirect: "manual",
        signal: controller.signal,
      });
      clearTimeout(timer);

      // Check if this is a redirect response
      const isRedirect = response.status >= 300 && response.status < 400;
      if (!isRedirect) {
        return response;
      }

      // Get the redirect location
      const location = response.headers.get("location");
      if (!location) {
        // No location header, return the redirect response as-is
        return response;
      }

      // Resolve relative URLs
      const nextUrl = new URL(location, currentUrl).toString();

      // Check if we should follow this redirect
      if (!isAllowedRedirect(currentUrl, nextUrl)) {
        // Return the redirect response without following
        return response;
      }

      // Follow the redirect
      currentUrl = nextUrl;
      redirectCount++;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  // Max redirects exceeded
  throw new Error(
    `Too many redirects (${maxRedirects}) when fetching ${currentUrl}`,
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
        console.warn("Cleanup error:", err);
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
