import { BASE_URL } from "@/lib/constants/app";

export interface IconFetchSuccess {
  success: true;
  imageBase64: string;
  contentType: string | null;
  sourceName: string;
}

export interface IconFetchFailure {
  success: false;
  /**
   * True when this was a definitive "no icon exists / cannot be fetched" outcome
   * (e.g. 404s everywhere, NXDOMAIN for direct fetches, blocked/private host).
   *
   * False when at least one source failed in a way that might be transient
   * (e.g. 5xx, timeouts), meaning we should avoid caching this as "permanently not found".
   */
  allNotFound: boolean;
}

export type IconFetchResult = IconFetchSuccess | IconFetchFailure;

export interface FetchIconOptions {
  /** Size of the icon to request */
  size: number;
  /** Maximum bytes to download */
  maxBytes: number;
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Whether to use logo.dev as a source */
  useLogoDev?: boolean;
}

/**
 * A source for fetching icons.
 */
export interface IconSource {
  url: string;
  /** Source identifier for logging (e.g., "duckduckgo", "logo_dev") */
  name: string;
  /** Optional custom headers for this source */
  headers?: Record<string, string>;
  /** Allow HTTP (default: false) */
  allowHttp?: boolean;
}

/**
 * Shared step for fetching icons from multiple sources with fallbacks.
 * Used by favicon and provider-logo workflows.
 */
export async function fetchIconFromSources(
  domain: string,
  options: FetchIconOptions,
): Promise<IconFetchResult> {
  "use step";

  const { safeFetch } = await import("@/lib/safe-fetch");

  const { size = 32, useLogoDev = false } = options;
  const sources: IconSource[] = [];

  // Primary: Logo.dev API (only if requested and API key is configured)
  const logoDevKey = process.env.LOGO_DEV_PUBLISHABLE_KEY;
  if (useLogoDev && logoDevKey) {
    sources.push({
      url: `https://img.logo.dev/${domain}?token=${logoDevKey}&size=${size}&format=png&fallback=404`,
      name: "logo_dev",
      headers: {
        Referer: BASE_URL,
      },
    });
  }

  // Fallback to standard favicon sources
  sources.push(
    {
      url: `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`,
      name: "google",
    },
    {
      url: `https://icons.duckduckgo.com/ip3/${domain}.ico`,
      name: "duckduckgo",
    },
    {
      url: `https://${domain}/favicon.ico`,
      name: "direct_https",
    },
    {
      url: `http://${domain}/favicon.ico`,
      name: "direct_http",
      allowHttp: true,
    },
  );

  let allNotFound = true;

  for (const source of sources) {
    try {
      const headers = {
        Accept: "image/avif,image/webp,image/png,image/*;q=0.9,*/*;q=0.8",
        ...source.headers,
      };

      const asset = await safeFetch({
        url: source.url,
        headers,
        maxBytes: options.maxBytes,
        timeoutMs: options.timeoutMs,
        maxRedirects: 2,
        allowHttp: source.allowHttp ?? false,
      });

      if (!asset.ok) {
        // 404 (and some "bad request" responses from upstream favicon APIs) are
        // definitive "not found". Other non-2xx are treated as non-definitive.
        const isDefinitiveNotFoundStatus =
          asset.status === 404 || asset.status === 400;
        if (!isDefinitiveNotFoundStatus) {
          allNotFound = false;
        }
        continue;
      }

      allNotFound = false;

      // Encode buffer as base64 for serialization
      return {
        success: true,
        imageBase64: asset.buffer.toString("base64"),
        contentType: asset.contentType ?? null,
        sourceName: source.name,
      };
    } catch (err) {
      // `safeFetch` throws on "infrastructure" failures (DNS/SSRF blocking/etc).
      // Some of these are actually definitive "not found" outcomes for our use case
      // (e.g. NXDOMAIN for `https://${domain}/favicon.ico`).
      if (!isDefinitiveNotFoundError(err)) {
        allNotFound = false;
      }
    }
  }

  return { success: false, allNotFound };
}

function isDefinitiveNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const maybe = err as { name?: unknown; code?: unknown };
  if (maybe.name !== "SafeFetchError") return false;

  // These codes are deterministic for a given input URL, and should be treated as
  // "no icon can be fetched" rather than something we should retry.
  //
  // In particular, `dns_error` is expected for non-existent domains (NXDOMAIN).
  const definitiveCodes = new Set([
    "dns_error",
    "host_blocked",
    "host_not_allowed",
    "private_ip",
    "protocol_not_allowed",
    "invalid_url",
  ]);

  return typeof maybe.code === "string" && definitiveCodes.has(maybe.code);
}
