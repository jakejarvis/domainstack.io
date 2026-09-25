import { toRegistrableDomain as toRegistrableDomainRaw } from "rdapper";

import { BLACKLISTED_SUFFIXES } from "@domainstack/constants";

import { normalizeDomainInput } from "./client";

/** Extract the TLD from a domain (e.g., "example.co.uk" -> "co.uk") using the Public Suffix List. */
export { getDomainTld } from "rdapper";

/**
 * Convert a domain/URL input to its registrable domain (eTLD+1), with input
 * normalization and blacklist filtering.
 *
 * Examples:
 * - "www.example.com" → "example.com"
 * - "https://blog.example.co.uk/path" → "example.co.uk"
 * - "ns1.cloudflare.com" → "cloudflare.com"
 *
 * @param input - Domain name, hostname, or URL
 * @returns Registrable domain or null if invalid/blacklisted
 */
export function toRegistrableDomain(input: string): string | null {
  // First normalize the input to extract a clean hostname
  // This handles user input with schemes, paths, ports, auth, trailing dots, www., etc.
  const normalized = normalizeDomainInput(input);
  if (!normalized) return null;

  const value = normalized.trim().toLowerCase();
  if (value === "") return null;

  // Shortcut: exact suffixes such as ".css.map" that frequently appear
  for (const suffix of BLACKLISTED_SUFFIXES) {
    if (value.endsWith(suffix)) return null;
  }

  return toRegistrableDomainRaw(value);
}
