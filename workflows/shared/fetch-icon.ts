import { RetryableError } from "workflow";
import { BASE_URL } from "@/lib/constants/app";

export interface IconFetchSuccess {
  success: true;
  imageBase64: string;
  contentType: string | null;
  sourceName: string;
}

export interface IconFetchFailure {
  success: false;
  allNotFound: true;
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
  /** Logger source identifier */
  loggerSource: string;
  /** Error message prefix for RetryableError */
  errorPrefix: string;
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

  const { fetchRemoteAsset, RemoteAssetError } = await import(
    "@/lib/fetch-remote-asset"
  );
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: options.loggerSource });

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
      url: `https://icons.duckduckgo.com/ip3/${domain}.ico`,
      name: "duckduckgo",
    },
    {
      url: `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`,
      name: "google",
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

      const asset = await fetchRemoteAsset({
        url: source.url,
        headers,
        maxBytes: options.maxBytes,
        timeoutMs: options.timeoutMs,
        maxRedirects: 2,
        allowHttp: source.allowHttp ?? false,
      });

      if (!asset.ok) {
        // 404 is still considered a true "not found", other errors are not
        if (asset.status !== 404) {
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
      if (!(err instanceof RemoteAssetError)) {
        logger.warn({ err, domain, source: source.name }, "fetch failed");
      }
      // Infrastructure errors are not "not found"
      allNotFound = false;
    }
  }

  // If all sources returned 404, it's a permanent failure (no icon exists)
  // Otherwise, it could be transient network issues - throw to retry
  if (!allNotFound) {
    logger.warn(
      { domain },
      `${options.errorPrefix} fetch failed with non-404 errors, will retry`,
    );
    throw new RetryableError(`${options.errorPrefix} fetch failed`, {
      retryAfter: "3s",
    });
  }

  return { success: false, allNotFound: true };
}
