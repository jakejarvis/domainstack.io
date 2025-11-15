import "server-only";
import { getDomainTld } from "rdapper";
import { upsertDomain } from "@/lib/db/repos/domains";

/**
 * Parse domain name and ensure a domain record exists in Postgres.
 * This is used by services that need to persist data for a domain (favicon, screenshot, etc.)
 * even when a full domain report hasn't been requested.
 *
 * @param domain - The domain name (should already be normalized/registrable)
 * @returns The domain record with its ID
 */
export async function ensureDomainRecord(domain: string) {
  const tld = getDomainTld(domain) ?? "";

  // For unicode handling, we'd need to use toUnicode from node:url or a library,
  // but for now we'll use the ASCII version as the unicode name if they match
  // This is safe because rdapper already normalizes to ASCII/punycode when needed
  const unicodeName = domain;

  const domainRecord = await upsertDomain({
    name: domain,
    tld,
    unicodeName,
  });

  return domainRecord;
}
