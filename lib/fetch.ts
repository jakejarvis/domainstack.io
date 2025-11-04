export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  opts: { timeoutMs?: number; retries?: number; backoffMs?: number } = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 5000;
  const retries = Math.max(0, opts.retries ?? 0);
  const backoffMs = Math.max(0, opts.backoffMs ?? 150);

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
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
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("fetch failed");
}

export async function headThenGet(
  url: string,
  init: RequestInit = {},
  opts: { timeoutMs?: number } = {},
): Promise<{ response: Response; usedMethod: "HEAD" | "GET" }> {
  const timeoutMs = opts.timeoutMs ?? 5000;
  try {
    const headRes = await fetchWithTimeout(
      url,
      { ...init, method: "HEAD", redirect: "follow" },
      { timeoutMs },
    );
    if (headRes.ok) {
      return { response: headRes, usedMethod: "HEAD" };
    }
  } catch {
    // fall through to GET
  }

  const getRes = await fetchWithTimeout(
    url,
    { ...init, method: "GET", redirect: "follow" },
    { timeoutMs },
  );
  return { response: getRes, usedMethod: "GET" };
}

/**
 * Checks if a redirect from one URL to another is allowed.
 * Only allows redirects between apex/www or http/https versions of the same domain.
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

    // Allow if path, search, and hash are the same (only scheme or www prefix changed)
    const isSchemeLike =
      from.pathname === to.pathname &&
      from.search === to.search &&
      from.hash === to.hash;
    if (isSchemeLike) {
      return true;
    }

    return false;
  } catch {
    // If URL parsing fails, don't allow redirect
    return false;
  }
}

/**
 * Fetch with manual redirect handling that only follows redirects between
 * apex/www or http/https versions of the same domain.
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
