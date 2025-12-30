import "server-only";

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

import {
  applyDecayToTtl,
  getDecayMultiplier,
  shouldStopRevalidation,
} from "@/lib/revalidation";
import { type Section, SectionEnum } from "@/lib/schemas";

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

export function allSections(): Section[] {
  return SectionEnum.options as Section[];
}

/**
 * Schedule a section revalidation for a domain by sending an Inngest event.
 * Uses Inngest's native scheduling (sendAt) and deduplication (stable event ID).
 *
 * @param domain - The domain to revalidate
 * @param section - The section to revalidate
 * @param dueAtMs - When the revalidation should run (milliseconds since epoch)
 * @param lastAccessedAt - When the domain was last accessed (for decay calculation)
 * @returns true if scheduled, false if skipped
 */
export async function scheduleRevalidation(
  domain: string,
  section: Section,
  dueAtMs: number,
  lastAccessedAt?: Date | null,
): Promise<boolean> {
  // Normalize domain for consistency
  const normalizedDomain =
    typeof domain === "string" ? domain.trim().toLowerCase() : domain;

  // Check if domain should stop being revalidated due to inactivity
  if (shouldStopRevalidation(section, lastAccessedAt ?? null)) {
    logger.debug("skip (stopped: inactive)", {
      domain: normalizedDomain,
      section,
      lastAccessedAt: lastAccessedAt?.toISOString() ?? "never",
    });
    return false;
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
    return false;
  }

  // Enforce minimum TTL for this section
  const minDueMs = now + minTtlSecondsForSection(section) * 1000;
  let scheduledDueMs = Math.max(decayedDueMs, minDueMs);

  // Ensure timestamp is always in the future to prevent negative timeout warnings
  // This handles race conditions where dueAtMs was calculated in the past
  if (scheduledDueMs <= now) {
    scheduledDueMs = now + minTtlSecondsForSection(section) * 1000;
    logger.warn("adjusted past timestamp", {
      domain: normalizedDomain,
      section,
      originalDueMs: dueAtMs,
      adjustedDueMs: scheduledDueMs,
    });
  }

  // Send event to Inngest
  // Use stable event ID (domain+section) to enable Inngest's built-in deduplication.
  // This prevents queueing duplicate events during request bursts, while still allowing
  // rescheduling at different times (Inngest replaces pending events with same ID).
  // Duplicate work is further prevented by Inngest's concurrency control (configured
  // in the function), which ensures only one instance of domain+section runs at a time.
  try {
    const eventId = `${normalizedDomain}:${section}`;
    await inngest.send({
      name: INNGEST_EVENTS.SECTION_REVALIDATE,
      data: {
        domain: normalizedDomain,
        section,
      },
      ts: scheduledDueMs,
      id: eventId,
    });
    return true;
  } catch (err) {
    logger.error("unexpected failure", err, {
      domain: normalizedDomain,
      section,
    });
    return false;
  }
}
