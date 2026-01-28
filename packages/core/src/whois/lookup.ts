/**
 * WHOIS/RDAP lookup using rdapper.
 */

import { type BootstrapData, lookup } from "rdapper";
import type { RdapLookupResult, WhoisLookupOptions } from "./types";
import { RDAP_BOOTSTRAP_URL } from "./types";

/**
 * Check if error indicates an unsupported TLD.
 */
function isExpectedRegistrationError(error: unknown): boolean {
  if (!error) return false;

  const errorStr = String(error).toLowerCase();

  return (
    errorStr.includes("no whois server discovered") ||
    errorStr.includes("no rdap server found") ||
    errorStr.includes("registry may not publish public whois") ||
    errorStr.includes("tld is not supported") ||
    errorStr.includes("no whois server configured")
  );
}

/**
 * Check if error is a timeout.
 */
function isTimeoutError(error: unknown): boolean {
  if (!error) return false;

  const errorStr = String(error).toLowerCase();
  return (
    errorStr.includes("whois socket timeout") ||
    errorStr.includes("whois timeout") ||
    errorStr.includes("rdap timeout")
  );
}

/**
 * Fetch RDAP bootstrap data from IANA.
 *
 * When running in Next.js, this uses the Data Cache with 1 week TTL.
 * In other environments, the `next` option is safely ignored.
 *
 * @param userAgent - User agent for the request
 * @returns Bootstrap data or undefined if fetch fails
 */
export async function fetchBootstrapData(
  userAgent?: string,
): Promise<BootstrapData | undefined> {
  try {
    const res = await fetch(RDAP_BOOTSTRAP_URL, {
      headers: {
        ...(userAgent ? { "User-Agent": userAgent } : {}),
      },
      // Next.js Data Cache - 1 week TTL (ignored in non-Next.js environments)
      next: { revalidate: 604_800 },
    } as RequestInit);

    if (!res.ok) {
      return undefined;
    }

    return (await res.json()) as BootstrapData;
  } catch {
    return undefined;
  }
}

/**
 * Lookup domain registration via rdapper (WHOIS/RDAP).
 *
 * @param domain - The domain to lookup
 * @param options - Lookup options
 * @returns RdapLookupResult with record JSON or error
 */
export async function lookupWhois(
  domain: string,
  options: WhoisLookupOptions = {},
): Promise<RdapLookupResult> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const includeRaw = options.includeRaw ?? true;

  // Use provided bootstrap data or fetch it
  const bootstrapData =
    (options.customBootstrapData as BootstrapData | undefined) ??
    (await fetchBootstrapData(options.userAgent));

  try {
    const { ok, record, error } = await lookup(domain, {
      timeoutMs,
      includeRaw,
      ...(bootstrapData ? { customBootstrapData: bootstrapData } : {}),
    });

    if (!ok || !record) {
      const isUnsupported = isExpectedRegistrationError(error);
      const isTimeout = isTimeoutError(error);

      if (isUnsupported) {
        return { success: false, error: "unsupported_tld" };
      }

      if (isTimeout) {
        return { success: false, error: "timeout" };
      }

      return { success: false, error: "retry" };
    }

    return { success: true, recordJson: JSON.stringify(record) };
  } catch {
    return { success: false, error: "retry" };
  }
}
