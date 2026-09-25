/**
 * DNS TXT record verification for domain ownership.
 */

import {
  DNS_VERIFICATION_HOST_LEGACY,
  DNS_VERIFICATION_PREFIX,
  DNS_VERIFICATION_PREFIX_LEGACY,
} from "@domainstack/constants";
import type { VerificationResult } from "@domainstack/types";

import { providerOrderForLookup, queryDohProvider } from "../dns/doh";

/**
 * Verify domain ownership via DNS TXT record.
 *
 * Expected record formats:
 * - New: `example.com TXT "domainstack-verification=<token>"`
 * - Legacy value: `example.com TXT "domainstack-verify=<token>"` (domains
 *   verified before the prefix was renamed)
 * - Legacy host: `_domainstack-verify.example.com TXT "domainstack-verify=<token>"`
 *
 * Uses multiple DoH providers for reliability and cache busting.
 *
 * @param domain - The domain to verify
 * @param token - The verification token to look for
 * @returns Verification result
 */
export async function verifyByDns(domain: string, token: string): Promise<VerificationResult> {
  const expectedValue = `${DNS_VERIFICATION_PREFIX}${token}`;
  const expectedValueLegacy = `${DNS_VERIFICATION_PREFIX_LEGACY}${token}`;

  // Check both apex domain (new) and legacy subdomain format
  const hostsToCheck = [
    domain, // New format: example.com
    `${DNS_VERIFICATION_HOST_LEGACY}.${domain}`, // Legacy: _domainstack-verify.example.com
  ];

  const providers = providerOrderForLookup(domain);

  const outcomesByHost = await Promise.all(
    hostsToCheck.map(async (hostname) => {
      const outcomes = await Promise.all(
        providers.map(async (provider) => {
          try {
            const answers = await queryDohProvider(provider, hostname, "TXT", {
              cacheBust: true, // Bypass caches to check freshly added records
            });

            const matched = answers.some((answer) => {
              const value = answer.data.replace(/^"|"$/g, "").trim();
              return value === expectedValue || value === expectedValueLegacy;
            });
            return matched ? "matched" : "no_match";
          } catch {
            // This provider/host lookup itself failed (network/timeout/DNS
            // resolver error) — it neither confirms nor rules out the record.
            return "failed";
          }
        }),
      );
      return outcomes;
    }),
  );

  if (outcomesByHost.some((outcomes) => outcomes.includes("matched"))) {
    return { verified: true, method: "dns_txt" };
  }

  // checkFailed if any single host's lookups all failed — a clean answer
  // from the other host (e.g. an unused legacy subdomain) shouldn't mask a
  // resolver failure on the host that actually holds the proof.
  const checkFailed = outcomesByHost.some((outcomes) =>
    outcomes.every((outcome) => outcome === "failed"),
  );
  return { verified: false, method: null, checkFailed };
}
