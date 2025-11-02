import "server-only";

import {
  FAST_CHANGING_TIERS,
  REVALIDATE_MIN_CERTIFICATES,
  REVALIDATE_MIN_DNS,
  REVALIDATE_MIN_HEADERS,
  REVALIDATE_MIN_HOSTING,
  REVALIDATE_MIN_REGISTRATION,
  REVALIDATE_MIN_SEO,
  SLOW_CHANGING_TIERS,
} from "@/lib/constants";
import { ns, redis } from "@/lib/redis";
import type { Section } from "@/lib/schemas";

/**
 * Record that a domain was accessed (for decay calculation).
 * Fire-and-forget pattern: does not throw on errors.
 *
 * @param domain - The domain name that was accessed
 */
export function recordDomainAccess(domain: string): void {
  // Fire-and-forget: intentionally not awaited to avoid blocking
  // Errors are silently ignored to prevent access tracking from breaking services
  const key = ns("access", "domain", domain);
  const timestamp = Date.now();
  redis.set(key, timestamp).catch(() => {
    // Silently ignore Redis errors for access tracking
  });
}

/**
 * Get the base revalidation interval (in seconds) for a section.
 */
function getBaseTtlSeconds(section: Section): number {
  switch (section) {
    case "dns":
      return REVALIDATE_MIN_DNS;
    case "headers":
      return REVALIDATE_MIN_HEADERS;
    case "hosting":
      return REVALIDATE_MIN_HOSTING;
    case "certificates":
      return REVALIDATE_MIN_CERTIFICATES;
    case "seo":
      return REVALIDATE_MIN_SEO;
    case "registration":
      return REVALIDATE_MIN_REGISTRATION;
  }
}

/**
 * Determines if a section is fast-changing based on its base TTL.
 * Fast-changing sections have shorter TTLs (≤6 hours) and are checked more frequently.
 */
function isFastChangingSection(section: Section): boolean {
  const baseTtlSeconds = getBaseTtlSeconds(section);
  const sixHoursInSeconds = 6 * 60 * 60;
  return baseTtlSeconds <= sixHoursInSeconds;
}

/**
 * Calculate the decay multiplier for a section based on last accessed time.
 * Returns null if the domain should stop being revalidated (beyond cutoff threshold).
 *
 * @param section - The section type to calculate decay for
 * @param lastAccessedAt - When the domain was last accessed, or null if never tracked
 * @returns The multiplier to apply (1, 3, 5, 10, 20, 30, 50) or null to stop scheduling
 */
export function getDecayMultiplier(
  section: Section,
  lastAccessedAt: Date | null,
): number | null {
  // If never accessed or accessed in the future (clock skew), use normal cadence
  if (!lastAccessedAt || lastAccessedAt > new Date()) {
    return 1;
  }

  const now = Date.now();
  const accessedAtMs = lastAccessedAt.getTime();
  const inactiveDays = (now - accessedAtMs) / (1000 * 60 * 60 * 24);

  const tiers = isFastChangingSection(section)
    ? FAST_CHANGING_TIERS
    : SLOW_CHANGING_TIERS;

  // Find the appropriate tier based on inactivity
  // Check from highest to lowest to match the most specific tier
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (inactiveDays >= tiers[i].days) {
      return tiers[i].multiplier;
    }
  }

  // Fallback to tier 0 (should always match since tier 0 starts at day 0)
  return tiers[0].multiplier;
}

/**
 * Check if a domain should stop being revalidated based on inactivity.
 *
 * @param section - The section type to check
 * @param lastAccessedAt - When the domain was last accessed, or null if never tracked
 * @returns true if revalidation should stop
 */
export function shouldStopRevalidation(
  section: Section,
  lastAccessedAt: Date | null,
): boolean {
  // If never accessed, keep revalidating at normal cadence
  if (!lastAccessedAt) {
    return false;
  }

  const now = Date.now();
  const accessedAtMs = lastAccessedAt.getTime();

  // If accessed in the future (clock skew), don't stop
  if (accessedAtMs > now) {
    return false;
  }

  const inactiveDays = (now - accessedAtMs) / (1000 * 60 * 60 * 24);

  // Fast-changing sections: stop after 180 days
  // Slow-changing sections: stop after 90 days
  const cutoffDays = isFastChangingSection(section) ? 180 : 90;

  return inactiveDays > cutoffDays;
}

/**
 * Apply the decay multiplier to a base TTL.
 *
 * @param baseTtlMs - The base TTL in milliseconds
 * @param multiplier - The decay multiplier (1, 3, 5, 10, 20, 30, 50)
 * @returns The adjusted TTL in milliseconds
 */
export function applyDecayToTtl(baseTtlMs: number, multiplier: number): number {
  if (!Number.isFinite(baseTtlMs) || baseTtlMs <= 0) {
    return baseTtlMs;
  }
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    return baseTtlMs;
  }
  return baseTtlMs * multiplier;
}
