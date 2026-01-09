import "server-only";

import type { BootstrapData } from "rdapper";
import { USER_AGENT } from "@/lib/constants/app";

/**
 * RDAP Bootstrap Registry URL from IANA.
 * This JSON file maps TLDs to their authoritative RDAP servers.
 * @see https://datatracker.ietf.org/doc/html/rfc7484
 */
const RDAP_BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json";

/**
 * Fetch RDAP bootstrap data with Next.js Data Cache.
 *
 * The bootstrap registry changes infrequently (new TLDs, server updates),
 * so we cache it for 1 week with stale-while-revalidate.
 *
 * This eliminates redundant fetches to IANA on every domain lookup when
 * passed to rdapper's lookup() via the customBootstrapData option.
 *
 * @returns RDAP bootstrap data containing TLD-to-server mappings
 * @throws Error if fetch fails (caller should handle or let rdapper fetch directly)
 */
export async function getRdapBootstrapData(): Promise<BootstrapData> {
  const res = await fetch(RDAP_BOOTSTRAP_URL, {
    headers: {
      "User-Agent": USER_AGENT,
    },
    next: {
      revalidate: 604_800, // 1 week
    },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch RDAP bootstrap: ${res.status} ${res.statusText}`,
    );
  }

  const bootstrap = await res.json();
  return bootstrap;
}
