import "server-only";
import { cacheLife } from "next/cache";
import type { BootstrapData } from "rdapper";
import { RDAP_BOOTSTRAP_URL } from "@/lib/constants";

/**
 * Fetch RDAP bootstrap data with Cache Components.
 *
 * The bootstrap registry changes infrequently (new TLDs, server updates),
 * so we cache it for 1 day using Next.js 16 Cache Components.
 *
 * This eliminates redundant fetches to IANA on every domain lookup when
 * passed to rdapper's lookup() via the customBootstrapData option.
 *
 * @returns RDAP bootstrap data containing TLD-to-server mappings
 * @throws Error if fetch fails (caller should handle or let rdapper fetch directly)
 */
export async function getRdapBootstrapData(): Promise<BootstrapData> {
  "use cache";
  cacheLife("days");

  const res = await fetch(RDAP_BOOTSTRAP_URL);

  if (!res.ok) {
    throw new Error(
      `Failed to fetch RDAP bootstrap: ${res.status} ${res.statusText}`,
    );
  }

  return res.json();
}
