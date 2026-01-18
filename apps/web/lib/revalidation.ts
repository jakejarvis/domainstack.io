import "server-only";

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

const logger = createLogger({ source: "revalidation" });

/**
 * In-memory map of recently scheduled revalidation events.
 * Prevents duplicate Inngest API calls when multiple concurrent persist steps
 * try to schedule the same domain+section.
 *
 * Map: eventId (domain:section) -> timestamp
 */
const recentlyScheduled = new Map<string, number>();

/** How long to consider an event "recently scheduled" (5 seconds) */
const RECENT_SCHEDULE_WINDOW_MS = 5000;

/** Max entries before cleanup (prevents unbounded growth) */
const MAX_RECENT_ENTRIES = 1000;

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
 * Revalidation timing is calculated from the base TTL for the section,
 * with decay multipliers applied based on domain inactivity.
 *
 * @param domain - The domain to revalidate
 * @param section - The section to revalidate
 * @param lastAccessedAt - When the domain was last accessed (for decay calculation)
 */
export async function scheduleRevalidation(
  domain: string,
  section: Section,
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

  // Calculate revalidation timing with decay multiplier
  // Start with the base TTL for this section, then apply decay based on inactivity
  const now = Date.now();
  const decayMultiplier = getDecayMultiplier(section, lastAccessedAt ?? null);
  const baseTtlMs = minTtlSecondsForSection(section) * 1000;
  const decayedTtlMs = applyDecayToTtl(baseTtlMs, decayMultiplier);
  const scheduledDueMs = now + decayedTtlMs;

  // Send event to Inngest
  // Use stable event ID (domain+section) to enable Inngest's built-in deduplication.
  // This prevents queueing duplicate events during request bursts, while still allowing
  // rescheduling at different times (Inngest replaces pending events with same ID).
  // Duplicate work is further prevented by Inngest's concurrency control (configured
  // in the function), which ensures only one instance of domain+section runs at a time.
  const eventId = `${normalizedDomain}:${section}`;

  // In-memory deduplication: check if we recently scheduled this exact event
  // This prevents unnecessary Inngest API calls when multiple concurrent persist
  // steps try to schedule the same domain+section within a short time window.
  const recentTimestamp = recentlyScheduled.get(eventId);
  if (recentTimestamp && now - recentTimestamp < RECENT_SCHEDULE_WINDOW_MS) {
    logger.debug(
      { domain: normalizedDomain, section },
      "skip (recently scheduled)",
    );
    return;
  }

  await inngest.send({
    name: INNGEST_EVENTS.SECTION_REVALIDATE,
    data: {
      domain: normalizedDomain,
      section,
    },
    ts: scheduledDueMs,
    id: eventId,
  });

  // Track this scheduling to prevent duplicate API calls
  recentlyScheduled.set(eventId, now);

  // Periodic cleanup: remove old entries to prevent unbounded memory growth
  if (recentlyScheduled.size > MAX_RECENT_ENTRIES) {
    const cutoff = now - RECENT_SCHEDULE_WINDOW_MS * 2;
    for (const [key, ts] of recentlyScheduled.entries()) {
      if (ts < cutoff) {
        recentlyScheduled.delete(key);
      }
    }
  }
}

/**
 * Schedule revalidation for multiple sections at once using a single Inngest API call.
 * This is more efficient than calling scheduleRevalidation() multiple times when
 * a workflow needs to schedule revalidation for several sections.
 *
 * @param domain - The domain to revalidate
 * @param sections - The sections to revalidate
 * @param lastAccessedAt - When the domain was last accessed (for decay calculation)
 */
export async function scheduleRevalidationBatch(
  domain: string,
  sections: Section[],
  lastAccessedAt?: Date | null,
): Promise<void> {
  if (sections.length === 0) return;

  // Normalize domain for consistency
  const normalizedDomain =
    typeof domain === "string" ? domain.trim().toLowerCase() : domain;

  const now = Date.now();
  const events: Array<{
    name: string;
    data: { domain: string; section: Section };
    ts: number;
    id: string;
  }> = [];

  for (const section of sections) {
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
      continue;
    }

    const eventId = `${normalizedDomain}:${section}`;

    // Check in-memory deduplication
    const recentTimestamp = recentlyScheduled.get(eventId);
    if (recentTimestamp && now - recentTimestamp < RECENT_SCHEDULE_WINDOW_MS) {
      logger.debug(
        { domain: normalizedDomain, section },
        "skip (recently scheduled)",
      );
      continue;
    }

    // Calculate timing with decay
    const decayMultiplier = getDecayMultiplier(section, lastAccessedAt ?? null);
    const baseTtlMs = minTtlSecondsForSection(section) * 1000;
    const decayedTtlMs = applyDecayToTtl(baseTtlMs, decayMultiplier);
    const scheduledDueMs = now + decayedTtlMs;

    events.push({
      name: INNGEST_EVENTS.SECTION_REVALIDATE,
      data: {
        domain: normalizedDomain,
        section,
      },
      ts: scheduledDueMs,
      id: eventId,
    });

    // Track this scheduling
    recentlyScheduled.set(eventId, now);
  }

  // Send all events in a single API call
  if (events.length > 0) {
    await inngest.send(events);

    logger.debug(
      { domain: normalizedDomain, sections: events.map((e) => e.data.section) },
      "scheduled revalidation batch",
    );
  }

  // Periodic cleanup
  if (recentlyScheduled.size > MAX_RECENT_ENTRIES) {
    const cutoff = now - RECENT_SCHEDULE_WINDOW_MS * 2;
    for (const [key, ts] of recentlyScheduled.entries()) {
      if (ts < cutoff) {
        recentlyScheduled.delete(key);
      }
    }
  }
}
