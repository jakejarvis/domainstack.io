/**
 * Domain ownership verification module.
 *
 * Provides utilities for verifying domain ownership via:
 * - DNS TXT records
 * - HTML files
 * - Meta tags
 */

import type { VerificationMethod } from "@domainstack/constants";
import { verifyByDns } from "./dns";
import { verifyByHtmlFile } from "./html";
import { verifyByMetaTag } from "./meta";
import type { VerificationHttpOptions, VerificationResult } from "./types";

// Re-export individual verification methods
export { verifyByDns } from "./dns";
export { verifyByHtmlFile } from "./html";
export { verifyByMetaTag } from "./meta";

// Re-export types
export type { VerificationHttpOptions, VerificationResult } from "./types";

/**
 * Verify domain ownership by trying all methods in order.
 * Returns on first successful verification.
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
  // Try DNS first (most reliable)
  const dnsResult = await verifyByDns(domain, token);
  if (dnsResult.verified) return dnsResult;

  // Try HTML file
  const htmlResult = await verifyByHtmlFile(domain, token, options);
  if (htmlResult.verified) return htmlResult;

  // Try meta tag
  const metaResult = await verifyByMetaTag(domain, token, options);
  if (metaResult.verified) return metaResult;

  return { verified: false, method: null };
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
