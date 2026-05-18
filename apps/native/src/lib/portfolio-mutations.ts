import type { TrackedDomainWithDetails } from "@domainstack/types";

/**
 * Count affected domains by their current lifecycle state, deduped across every
 * cached `listDomains` variant so a domain present in multiple entries (e.g.
 * includeArchived true/false) is counted once. The optimistic subscription
 * delta must reflect actual state transitions, not a blind ±1.
 *
 * Extracted from `useDashboardMutations` so this (the most failure-prone math
 * in the app) is unit-testable without a React/query harness.
 */
export function affectedCounts(
  previousDomains: [unknown, unknown][],
  ids: Iterable<string>,
): { active: number; archived: number } {
  const idSet = new Set(ids);
  const seen = new Set<string>();
  let active = 0;
  let archived = 0;
  for (const [, domains] of previousDomains) {
    if (!domains) continue;
    for (const d of domains as TrackedDomainWithDetails[]) {
      if (!idSet.has(d.id) || seen.has(d.id)) continue;
      seen.add(d.id);
      if (d.archivedAt) archived += 1;
      else active += 1;
    }
  }
  return { active, archived };
}

interface SubscriptionCounts {
  activeCount: number;
  archivedCount: number;
  planQuota: number;
  canAddMore: boolean;
}

/**
 * Apply an optimistic active/archived delta to the cached subscription,
 * clamping at zero and recomputing `canAddMore` from the new active count.
 * Preserves any extra fields on the subscription object.
 */
export function applySubscriptionDelta<T extends SubscriptionCounts>(
  sub: T,
  activeDelta: number,
  archivedDelta: number,
): T {
  const activeCount = Math.max(0, sub.activeCount + activeDelta);
  const archivedCount = Math.max(0, sub.archivedCount + archivedDelta);
  return { ...sub, activeCount, archivedCount, canAddMore: activeCount < sub.planQuota };
}
