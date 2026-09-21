/**
 * HTML file verification for domain ownership.
 */

import {
  HTML_FILE_CONTENT_PREFIX,
  HTML_FILE_DIR,
  HTML_FILE_PATH_LEGACY,
} from "@domainstack/constants";
import { safeFetch } from "@domainstack/safe-fetch";
import type { VerificationResult } from "@domainstack/types";

import type { VerificationHttpOptions } from "./types";

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

  // HTTPS only — see the note in meta.ts. DNS TXT is the fallback for
  // domains that cannot serve HTTPS. Per-token file first (new multi-user
  // method), then the legacy single file.
  const urls = [
    `https://${domain}${HTML_FILE_DIR}/${token}.html`,
    `https://${domain}${HTML_FILE_PATH_LEGACY}`,
  ];

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
        timeoutMs: 5000,
        maxBytes: 1024,
        maxRedirects: 3,
      });
      anyReachable = true;

      if (!result.ok) {
        continue;
      }

      if (result.buffer.toString("utf-8").trim() === expectedContent) {
        return { verified: true, method: "html_file" };
      }
    } catch {
      // Network/DNS/TLS/timeout failure for this URL — try the next one.
    }
  }

  return { verified: false, method: null, checkFailed: !anyReachable };
}
