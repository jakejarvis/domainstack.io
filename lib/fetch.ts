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

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    // Create a fresh controller per attempt so aborted signals don't leak.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(input, { ...init, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      lastError = err;
      clearTimeout(timer);
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
 * - To different domains (after normalizing www)
 */
function isAllowedRedirect(fromUrl: string, toUrl: string): boolean {
  try {
    const from = new URL(fromUrl);
    const to = new URL(toUrl);

    // Normalize hostnames by removing www. prefix for comparison
    const normalizeHost = (host: string) => host.replace(/^www\./i, "");
    const fromHost = normalizeHost(from.hostname);
    const toHost = normalizeHost(to.hostname);

    // Must be the same registrable domain (after removing www)
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
