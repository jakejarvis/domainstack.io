import { toRegistrableDomain as toRegistrableDomainRaw } from "rdapper";

import { BLACKLISTED_SUFFIXES } from "@domainstack/constants";

import { isValidDomain, normalizeDomainInput, normalizeHostnameInput } from "./client";

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

/** What a report describes: the exact hostname, and the registrable domain it belongs to. */
export interface DomainTarget {
  /** The exact normalized hostname, labels (including `www`) preserved. */
  hostname: string;
  /** Its registrable domain (eTLD+1), which owns registration and tracking. */
  registrableDomain: string;
  /** Whether `hostname` has labels beyond its registrable domain. */
  isSubdomain: boolean;
}

/**
 * Parse a domain/URL input into a report target, keeping the exact hostname.
 *
 * Examples:
 * - "example.com" → example.com / example.com / false
 * - "WWW.Example.com." → www.example.com / example.com / true
 * - "https://foo.example.co.uk/path" → foo.example.co.uk / example.co.uk / true
 *
 * @returns null for invalid or blacklisted input, or a hostname without a
 * registrable parent (e.g. a bare public suffix)
 */
export function parseDomainTarget(input: string): DomainTarget | null {
  const hostname = normalizeHostnameInput(input);
  if (!hostname) return null;

  for (const suffix of BLACKLISTED_SUFFIXES) {
    if (hostname.endsWith(suffix)) return null;
  }

  const registrableDomain = toRegistrableDomainRaw(hostname);
  if (!registrableDomain) return null;

  const isSubdomain = hostname !== registrableDomain;
  // The extra labels of a subdomain must be valid hostname labels too.
  if (isSubdomain && !isValidDomain(hostname)) return null;

  return { hostname, registrableDomain, isSubdomain };
}
