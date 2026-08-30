/**
 * DNS TXT record verification for domain ownership.
 */

import { DNS_VERIFICATION_HOST_LEGACY, DNS_VERIFICATION_PREFIX } from "@domainstack/constants";
import { providerOrderForLookup, queryDohProvider } from "@domainstack/utils/dns";

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
export async function verifyByDns(domain: string, token: string): Promise<VerificationResult> {
  const expectedValue = `${DNS_VERIFICATION_PREFIX}${token}`;

  // Check both apex domain (new) and legacy subdomain format
  const hostsToCheck = [
    domain, // New format: example.com
    `${DNS_VERIFICATION_HOST_LEGACY}.${domain}`, // Legacy: _domainstack-verify.example.com
  ];

  const providers = providerOrderForLookup(domain);
  const lookups = hostsToCheck.flatMap((hostname) =>
    providers.map((provider) => ({ hostname, provider })),
  );

  const matches = await Promise.all(
    lookups.map(async ({ hostname, provider }) => {
      try {
        const answers = await queryDohProvider(provider, hostname, "TXT", {
          cacheBust: true, // Bypass caches to check freshly added records
        });

        return answers.some((answer) => {
          const value = answer.data.replace(/^"|"$/g, "").trim();
          return value === expectedValue;
        });
      } catch {
        return false;
      }
    }),
  );

  if (matches.some(Boolean)) {
    return { verified: true, method: "dns_txt" };
  }

  return { verified: false, method: null };
}
