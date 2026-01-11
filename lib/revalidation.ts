import "server-only";

import { after } from "next/server";
import {
  FAST_CHANGING_TIERS,
  SLOW_CHANGING_TIERS,
} from "@/lib/constants/decay";
import type { Section } from "@/lib/constants/sections";
import {
  REVALIDATE_MIN_CERTIFICATES,
  REVALIDATE_MIN_DNS,
  REVALIDATE_MIN_HEADERS,
  REVALIDATE_MIN_HOSTING,
  REVALIDATE_MIN_REGISTRATION,
  REVALIDATE_MIN_SEO,
} from "@/lib/constants/ttl";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "schedule" });

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
 *
 * @param section - The section type to calculate decay for
 * @param lastAccessedAt - When the domain was last accessed, or null if never tracked
 * @returns The multiplier to apply (1, 3, 5, 10, 20, 30, 50)
 */
export function getDecayMultiplier(
  section: Section,
  lastAccessedAt: Date | null,
): number {
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

function minTtlSecondsForSection(section: Section): number {
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
 * Schedule a section revalidation for a domain by sending an Inngest event.
 * Uses Inngest's native scheduling (sendAt) and deduplication (stable event ID).
 *
 * @param domain - The domain to revalidate
 * @param section - The section to revalidate
 * @param dueAtMs - When the revalidation should run (milliseconds since epoch)
 * @param lastAccessedAt - When the domain was last accessed (for decay calculation)
 */
export async function scheduleRevalidation(
  domain: string,
  section: Section,
  dueAtMs: number,
  lastAccessedAt?: Date | null,
): Promise<void> {
  // Normalize domain for consistency
  const normalizedDomain =
    typeof domain === "string" ? domain.trim().toLowerCase() : domain;

  // Check if domain should stop being revalidated due to inactivity
  if (shouldStopRevalidation(section, lastAccessedAt ?? null)) {
    logger.debug(
      {
        domain: normalizedDomain,
        section,
        lastAccessedAt: lastAccessedAt?.toISOString() ?? "never",
      },
      "skip (stopped: inactive)",
    );
    return;
  }

  // Apply decay multiplier to the due time
  const decayMultiplier = getDecayMultiplier(section, lastAccessedAt ?? null);

  // Calculate the actual due time with decay applied
  const now = Date.now();
  const baseDelta = dueAtMs - now;
  const decayedDelta = applyDecayToTtl(baseDelta, decayMultiplier);
  const decayedDueMs = now + decayedDelta;

  // Validate dueAtMs before scheduling
  if (!Number.isFinite(decayedDueMs) || decayedDueMs < 0) {
    return;
  }

  // Enforce minimum TTL for this section
  const minDueMs = now + minTtlSecondsForSection(section) * 1000;
  let scheduledDueMs = Math.max(decayedDueMs, minDueMs);

  // Ensure timestamp is always in the future to prevent negative timeout warnings
  // This handles race conditions where dueAtMs was calculated in the past
  if (scheduledDueMs <= now) {
    scheduledDueMs = now + minTtlSecondsForSection(section) * 1000;
    logger.warn(
      {
        domain: normalizedDomain,
        section,
        originalDueMs: dueAtMs,
        adjustedDueMs: scheduledDueMs,
      },
      "adjusted past timestamp",
    );
  }

  // Send event to Inngest
  // Use stable event ID (domain+section) to enable Inngest's built-in deduplication.
  // This prevents queueing duplicate events during request bursts, while still allowing
  // rescheduling at different times (Inngest replaces pending events with same ID).
  // Duplicate work is further prevented by Inngest's concurrency control (configured
  // in the function), which ensures only one instance of domain+section runs at a time.
  const eventId = `${normalizedDomain}:${section}`;
  after(() => {
    inngest.send({
      name: INNGEST_EVENTS.SECTION_REVALIDATE,
      data: {
        domain: normalizedDomain,
        section,
      },
      ts: scheduledDueMs,
      id: eventId,
    });
  });
}
