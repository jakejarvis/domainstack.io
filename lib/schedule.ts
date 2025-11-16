import "server-only";

import {
  applyDecayToTtl,
  getDecayMultiplier,
  shouldStopRevalidation,
} from "@/lib/access";
import {
  REVALIDATE_MIN_CERTIFICATES,
  REVALIDATE_MIN_DNS,
  REVALIDATE_MIN_HEADERS,
  REVALIDATE_MIN_HOSTING,
  REVALIDATE_MIN_REGISTRATION,
  REVALIDATE_MIN_SEO,
} from "@/lib/constants/ttl";
import { inngest } from "@/lib/inngest/client";
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
 * This replaces the complex Redis sorted set approach with a simple, direct event send.
 * Inngest automatically handles deduplication, scheduling, and retry logic.
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
    console.info(
      `[schedule] skip ${section} ${normalizedDomain} (stopped: inactive ${lastAccessedAt ? `since ${lastAccessedAt.toISOString()}` : "never accessed"})`,
    );
    return false;
  }

  // Apply decay multiplier to the due time
  const decayMultiplier = getDecayMultiplier(section, lastAccessedAt ?? null);

  // Calculate the actual due time with decay applied
  const now = Date.now();
  const baseDelta = dueAtMs - now;
  const decayedDelta = applyDecayToTtl(baseDelta, decayMultiplier);
  const decayedDueMs = now + decayedDelta;

  // Log when decay is applied (multiplier > 1)
  if (decayMultiplier > 1) {
    const daysInactive = lastAccessedAt
      ? Math.floor((now - lastAccessedAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    console.info(
      `[schedule] decay ${section} ${normalizedDomain} (${decayMultiplier}x, inactive ${daysInactive ? `${daysInactive}d` : "unknown"})`,
    );
  }

  // Validate dueAtMs before scheduling
  if (!Number.isFinite(decayedDueMs) || decayedDueMs < 0) {
    return false;
  }

  // Enforce minimum TTL for this section
  const minDueMs = now + minTtlSecondsForSection(section) * 1000;
  const scheduledDueMs = Math.max(decayedDueMs, minDueMs);

  // Send event to Inngest
  // Note: We do NOT set an event ID here. Inngest will generate unique IDs for each event.
  // This allows multiple revalidations to be scheduled (e.g., hourly DNS checks).
  // Duplicate work is prevented by Inngest's concurrency control (configured in the function),
  // which ensures only one instance of domain+section runs at a time.
  try {
    await inngest.send({
      name: "section/revalidate",
      data: {
        domain: normalizedDomain,
        section,
      },
      ts: scheduledDueMs,
    });

    console.debug(
      `[schedule] ok ${section} ${normalizedDomain} at ${new Date(scheduledDueMs).toISOString()}`,
    );
    return true;
  } catch (err) {
    console.warn(
      `[schedule] failed ${section} ${normalizedDomain}`,
      err instanceof Error ? err : new Error(String(err)),
    );
    return false;
  }
}
