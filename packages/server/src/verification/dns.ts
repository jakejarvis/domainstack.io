/**
 * DNS TXT record verification for domain ownership.
 */

import {
  DNS_VERIFICATION_HOST_LEGACY,
  DNS_VERIFICATION_PREFIX,
} from "@domainstack/constants";
import {
  providerOrderForLookup,
  queryDohProvider,
} from "@domainstack/utils/dns";
import type { VerificationResult } from "./types";

/**
 * Verify domain ownership via DNS TXT record.
 *
 * Expected record formats:
 * - New: `example.com TXT "domainstack-verify=<token>"`
 * - Legacy: `_domainstack-verify.example.com TXT "domainstack-verify=<token>"`
 *
 * Uses multiple DoH providers for reliability and cache busting.
 *
 * @param domain - The domain to verify
 * @param token - The verification token to look for
 * @returns Verification result
 */
export async function verifyByDns(
  domain: string,
  token: string,
): Promise<VerificationResult> {
  const expectedValue = `${DNS_VERIFICATION_PREFIX}${token}`;

  // Check both apex domain (new) and legacy subdomain format
  const hostsToCheck = [
    domain, // New format: example.com
    `${DNS_VERIFICATION_HOST_LEGACY}.${domain}`, // Legacy: _domainstack-verify.example.com
  ];

  const providers = providerOrderForLookup(domain);

  for (const hostname of hostsToCheck) {
    for (const provider of providers) {
      try {
        const answers = await queryDohProvider(provider, hostname, "TXT", {
          cacheBust: true, // Bypass caches to check freshly added records
        });

        for (const answer of answers) {
          const value = answer.data.replace(/^"|"$/g, "").trim();
          if (value === expectedValue) {
            return { verified: true, method: "dns_txt" };
          }
        }
      } catch {
        // Continue to next provider on failure
      }
    }
  }

  return { verified: false, method: null };
}
