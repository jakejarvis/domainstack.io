/**
 * Meta tag verification for domain ownership.
 */

import { META_TAG_NAME } from "@domainstack/constants";
import { safeFetch } from "@domainstack/safe-fetch";
import { extractMetaTagValues } from "../seo";
import type { VerificationHttpOptions, VerificationResult } from "./types";

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
  // Try both HTTPS and HTTP
  const urls = [`https://${domain}/`, `http://${domain}/`];

  for (const urlStr of urls) {
    try {
      const result = await safeFetch({
        url: urlStr,
        userAgent: options?.userAgent,
        allowHttp: true,
        allowedHosts: [domain, `www.${domain}`],
        timeoutMs: 10_000,
        maxBytes: MAX_HTML_BYTES,
        maxRedirects: 5,
      });

      if (!result.ok) {
        continue;
      }

      const html = result.buffer.toString("utf-8");
      const tokens = extractMetaTagValues(html, META_TAG_NAME);

      if (tokens.includes(token)) {
        return { verified: true, method: "meta_tag" };
      }
    } catch {
      // Continue to next URL on failure
    }
  }

  return { verified: false, method: null };
}
