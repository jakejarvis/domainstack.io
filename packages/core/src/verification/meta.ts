/**
 * Meta tag verification for domain ownership.
 */

import { META_TAG_NAME } from "@domainstack/constants";
import { safeFetch } from "@domainstack/safe-fetch";
import { SafeFetchError } from "@domainstack/safe-fetch/errors";
import type { VerificationResult } from "@domainstack/types";

import { decodeHtml, extractMetaTagValues } from "../seo/parse";
import type { VerificationHttpOptions } from "./types";

/** Maximum HTML size to fetch for meta tag verification */
const MAX_HTML_BYTES = 512 * 1024; // 512KB

/**
 * Verify domain ownership via meta tag.
 *
 * Expected tag: `<meta name="domainstack-verify" content="TOKEN">`
 *
 * Checks ALL verification meta tags to support multiple users tracking the same domain.
 *
 * @param domain - The domain to verify
 * @param token - The verification token to look for
 * @param options - HTTP request options
 * @returns Verification result
 */
export async function verifyByMetaTag(
  domain: string,
  token: string,
  options?: VerificationHttpOptions,
): Promise<VerificationResult> {
  // Ownership proofs are a trust boundary: a plaintext response can be forged by
  // anyone on the network path. HTTPS only. Domains that cannot serve HTTPS
  // should verify with the DNS TXT method instead.
  const urls = [`https://${domain}/`];

  // Whether any URL was reachable at all (an HTTP response, even a 404,
  // counts) — distinguishes a confirmed-absent proof from a probe that
  // never actually completed.
  let anyReachable = false;

  for (const urlStr of urls) {
    try {
      const result = await safeFetch({
        url: urlStr,
        userAgent: options?.userAgent,
        allowHttp: false,
        allowedHosts: [domain, `www.${domain}`],
        timeoutMs: 10_000,
        totalTimeoutMs: 15_000,
        maxBytes: MAX_HTML_BYTES,
        maxRedirects: 5,
        truncateOnLimit: true,
      });
      anyReachable = true;

      if (!result.ok) {
        continue;
      }

      const html = decodeHtml(result.buffer, result.contentType);
      const tokens = extractMetaTagValues(html, META_TAG_NAME);

      if (tokens.includes(token)) {
        return { verified: true, method: "meta_tag" };
      }
    } catch (err) {
      // The server answered; its body was just too big to be the proof we want.
      if (err instanceof SafeFetchError && err.code === "size_exceeded") {
        anyReachable = true;
      }
      // Otherwise: network/DNS/TLS/timeout failure for this URL — try the next one.
    }
  }

  return { verified: false, method: null, checkFailed: !anyReachable };
}
