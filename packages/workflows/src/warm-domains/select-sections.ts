import { SECTION_IDS } from "@domainstack/constants";
import type { Section } from "@domainstack/constants";

/**
 * Sections the warm-domains workflow refreshes: every section except DNS.
 * DNS is deliberately absent: its cache lifetime follows record TTLs (often
 * minutes), so a 4-hourly refresh is stale again long before the next visit.
 * Refreshing hosting refreshes DNS as a side effect anyway (`fetchHosting`
 * calls `fetchDns`).
 *
 * Technologies and SEO both warm: they share one in-flight HTML fetch when they
 * run concurrently (see fetchHtmlDocument), so warming both costs one request,
 * not two. Unlike headers-with-hosting, neither one persists the other's row, so
 * neither can be dropped when the other is selected.
 */
export const WARM_SECTIONS = SECTION_IDS.filter(
  (section): section is WarmSection => section !== "dns",
);

export type WarmSection = Exclude<Section, "dns">;

/**
 * Refresh anything that expires before the next warm-domains run. Must match
 * the cron interval in apps/web/vercel.json (every 4 hours, at :45).
 */
export const REFRESH_AHEAD_MS = 4 * 60 * 60 * 1000;

export type SectionCacheState = { data: unknown; expiresAt: Date | null };

/**
 * Pick the sections to refresh: missing, or expiring within REFRESH_AHEAD_MS.
 * Headers are dropped when hosting is selected, because `fetchHosting`
 * fetches and persists headers itself.
 */
export function selectSectionsToRefresh(
  cache: Record<WarmSection, SectionCacheState>,
  now: number,
): WarmSection[] {
  const due = WARM_SECTIONS.filter((section) => {
    const { data, expiresAt } = cache[section];
    return data === null || expiresAt === null || expiresAt.getTime() <= now + REFRESH_AHEAD_MS;
  });
  return due.includes("hosting") ? due.filter((section) => section !== "headers") : due;
}
