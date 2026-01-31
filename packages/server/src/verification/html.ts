/**
 * HTML file verification for domain ownership.
 */

import {
  HTML_FILE_CONTENT_PREFIX,
  HTML_FILE_DIR,
  HTML_FILE_PATH_LEGACY,
} from "@domainstack/constants";
import { safeFetch } from "@domainstack/safe-fetch";
import type { VerificationHttpOptions, VerificationResult } from "./types";

/**
 * Verify domain ownership via HTML file.
 *
 * Supports two methods (checked in order):
 * 1. Per-token file: `/.well-known/domainstack-verify/{token}.html`
 * 2. Legacy single file: `/.well-known/domainstack-verify.html`
 *
 * File contents must match: `domainstack-verify: TOKEN`
 *
 * @param domain - The domain to verify
 * @param token - The verification token to look for
 * @param options - HTTP request options
 * @returns Verification result
 */
export async function verifyByHtmlFile(
  domain: string,
  token: string,
  options?: VerificationHttpOptions,
): Promise<VerificationResult> {
  const expectedContent = `${HTML_FILE_CONTENT_PREFIX}${token}`;

  // Build URL lists for both methods, trying HTTPS first then HTTP
  const perTokenUrls = [
    `https://${domain}${HTML_FILE_DIR}/${token}.html`,
    `http://${domain}${HTML_FILE_DIR}/${token}.html`,
  ];
  const legacyUrls = [
    `https://${domain}${HTML_FILE_PATH_LEGACY}`,
    `http://${domain}${HTML_FILE_PATH_LEGACY}`,
  ];

  // Try per-token file first (new multi-user method)
  for (const urlStr of perTokenUrls) {
    try {
      const result = await safeFetch({
        url: urlStr,
        userAgent: options?.userAgent,
        allowHttp: true,
        allowedHosts: [domain, `www.${domain}`],
        timeoutMs: 5000,
        maxBytes: 1024,
        maxRedirects: 3,
      });

      if (!result.ok) {
        continue;
      }

      const content = result.buffer.toString("utf-8").trim();
      if (content === expectedContent) {
        return { verified: true, method: "html_file" };
      }
    } catch {
      // Continue to next URL on failure
    }
  }

  // Fall back to legacy single file method
  for (const urlStr of legacyUrls) {
    try {
      const result = await safeFetch({
        url: urlStr,
        userAgent: options?.userAgent,
        allowHttp: true,
        allowedHosts: [domain, `www.${domain}`],
        timeoutMs: 5000,
        maxBytes: 1024,
        maxRedirects: 3,
      });

      if (!result.ok) {
        continue;
      }

      if (result.buffer.toString("utf-8").trim() === expectedContent) {
        return { verified: true, method: "html_file" };
      }
    } catch {
      // Continue to next URL on failure
    }
  }

  return { verified: false, method: null };
}
