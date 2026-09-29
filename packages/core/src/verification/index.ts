/**
 * Domain ownership verification module.
 *
 * Provides utilities for verifying domain ownership via:
 * - DNS TXT records
 * - HTML files
 * - Meta tags
 */

import type { VerificationMethod, VerificationResult } from "@domainstack/types";

import { verifyByDns } from "./dns";
import { verifyByHtmlFile } from "./html";
import { verifyByMetaTag } from "./meta";
import type { VerificationHttpOptions } from "./types";

export { verifyByDns } from "./dns";
export { verifyByHtmlFile } from "./html";
export { verifyByMetaTag } from "./meta";
export type { VerificationHttpOptions } from "./types";

/**
 * Verify domain ownership by trying all methods at once.
 * Returns the first successful method in precedence order.
 *
 * Order: DNS (most reliable) -> HTML file -> Meta tag
 *
 * @param domain - The domain to verify
 * @param token - The verification token to look for
 * @param options - HTTP request options for HTML/meta verification
 * @returns Verification result with the method that succeeded
 */
export async function verifyDomain(
  domain: string,
  token: string,
  options?: VerificationHttpOptions,
): Promise<VerificationResult> {
  // Start every probe at once; read them in precedence order. A DNS match returns as
  // soon as DNS answers, and the failure path costs the slowest probe instead of the sum.
  const failed: VerificationResult = { verified: false, method: null, checkFailed: true };
  const settle = (p: Promise<VerificationResult>) => p.catch(() => failed);
  const dns = settle(verifyByDns(domain, token));
  const html = settle(verifyByHtmlFile(domain, token, options));
  const meta = settle(verifyByMetaTag(domain, token, options));

  const dnsResult = await dns;
  if (dnsResult.verified) return dnsResult;
  const htmlResult = await html;
  if (htmlResult.verified) return htmlResult;
  const metaResult = await meta;
  if (metaResult.verified) return metaResult;

  // Only report checkFailed if every method's probe failed to complete: one
  // clean (even non-matching) answer is a confirmed absence, not noise.
  const checkFailed =
    !!dnsResult.checkFailed && !!htmlResult.checkFailed && !!metaResult.checkFailed;
  return { verified: false, method: null, checkFailed };
}

/**
 * Verify domain ownership using a specific method only.
 *
 * @param domain - The domain to verify
 * @param token - The verification token to look for
 * @param method - The verification method to use
 * @param options - HTTP request options (for html_file and meta_tag methods)
 * @returns Verification result
 */
export async function verifyDomainByMethod(
  domain: string,
  token: string,
  method: VerificationMethod,
  options?: VerificationHttpOptions,
): Promise<VerificationResult> {
  switch (method) {
    case "dns_txt":
      return await verifyByDns(domain, token);
    case "html_file":
      return await verifyByHtmlFile(domain, token, options);
    case "meta_tag":
      return await verifyByMetaTag(domain, token, options);
    default:
      return { verified: false, method: null };
  }
}
