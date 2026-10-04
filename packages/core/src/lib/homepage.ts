/**
 * Load a domain's homepage once for both the headers and SEO services.
 *
 * A report fetches both sections at the same moment; sharing the in-flight GET
 * means the domain sees one page load instead of a HEAD for headers plus a GET
 * for SEO. Redirects are followed only between the apex and `www`: an off-host
 * redirect comes back as-is, which is what the headers section reports, and the
 * SEO service follows it from there with {@link PAGE_REQUEST_OPTIONS}.
 */

import { safeFetch } from "@domainstack/safe-fetch";
import type { SafeFetchOptions, SafeFetchResult } from "@domainstack/safe-fetch/types";

import { shareInFlight } from "./in-flight";

/** How a page is requested, shared by the homepage load and SEO's off-host continuation. */
export const PAGE_REQUEST_OPTIONS = {
  allowHttp: true,
  timeoutMs: 10_000,
  totalTimeoutMs: 15_000,
  maxBytes: 512 * 1024,
  truncateOnLimit: true,
  maxRedirects: 5,
  headers: {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en",
  },
} satisfies Partial<SafeFetchOptions>;

/**
 * Fetch `https://<domain>/`, following redirects between the apex and `www` only.
 *
 * Concurrent GETs for the same domain in this process share one request. `HEAD`
 * (for callers that need only headers, like monitoring) is never shared, and
 * retries as a GET when the server answers 405.
 */
export function fetchHomepage(
  domain: string,
  { method = "GET" }: { method?: "GET" | "HEAD" } = {},
): Promise<SafeFetchResult> {
  // Allow both the apex and www variants of the bare hostname.
  const [hostname] = domain
    .toLowerCase()
    .replace(/^www\./, "")
    .split(":");
  const request = () =>
    safeFetch({
      ...PAGE_REQUEST_OPTIONS,
      url: `https://${domain}/`,
      userAgent: process.env.EXTERNAL_USER_AGENT,
      method,
      fallbackToGetOnHeadFailure: method === "HEAD",
      allowedHosts: [hostname, `www.${hostname}`],
      returnOnDisallowedRedirect: true,
    });

  return method === "GET" ? shareInFlight(`homepage:${domain.toLowerCase()}`, request) : request();
}

/** True when {@link fetchHomepage} stopped at a redirect to another host. */
export function isOffHostRedirect(page: SafeFetchResult): boolean {
  return page.status >= 300 && page.status < 400;
}
