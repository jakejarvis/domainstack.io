import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import type { BootstrapData } from "rdapper";
import { RDAP_BOOTSTRAP_URL } from "@/lib/constants/external-apis";

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
  "use cache";
  cacheLife("weeks");
  cacheTag("rdap-bootstrap");

  const res = await fetch(RDAP_BOOTSTRAP_URL);

  if (!res.ok) {
    throw new Error(
      `Failed to fetch RDAP bootstrap: ${res.status} ${res.statusText}`,
    );
  }

  const bootstrap = await res.json();
  console.info("[rdap-bootstrap] Bootstrap data fetched");
  return bootstrap;
}
