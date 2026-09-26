import type { Section } from "@domainstack/constants";

/**
 * Sections the warm-domains workflow refreshes. DNS is deliberately absent: its
 * cache lifetime follows record TTLs (often minutes), so a 4-hourly refresh is
 * stale again long before the next visit. Refreshing hosting refreshes DNS as a
 * side effect anyway (`fetchHosting` calls `fetchDns`).
 */
export const WARM_SECTIONS = [
  "registration",
  "hosting",
  "certificates",
  "headers",
  "seo",
] as const satisfies readonly Section[];

export type WarmSection = (typeof WARM_SECTIONS)[number];

/**
 * Refresh anything that expires before the next warm-domains run. Must match
 * the cron interval in apps/web/vercel.json (every 4 hours, at :45).
 */
export const REFRESH_AHEAD_MS = 4 * 60 * 60 * 1000;

export type SectionCacheState = { data: unknown; expiresAt: Date | null };

/**
 * Pick the sections to refresh: missing, or expiring within REFRESH_AHEAD_MS.
 * Only sections present in `cache` are considered, so a caller leaves out the
 * ones outside the row's scope (registration for a subdomain).
 * Headers are dropped when hosting is selected, because `fetchHosting`
 * fetches and persists headers itself.
 */
export function selectSectionsToRefresh(
  cache: Partial<Record<WarmSection, SectionCacheState>>,
  now: number,
): WarmSection[] {
  const due = WARM_SECTIONS.filter((section) => {
    const state = cache[section];
    if (!state) return false;
    const { data, expiresAt } = state;
    return data === null || expiresAt === null || expiresAt.getTime() <= now + REFRESH_AHEAD_MS;
  });
  return due.includes("hosting") ? due.filter((section) => section !== "headers") : due;
}
