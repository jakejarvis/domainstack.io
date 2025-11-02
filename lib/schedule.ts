import "server-only";

import {
  applyDecayToTtl,
  getDecayMultiplier,
  shouldStopRevalidation,
} from "@/lib/access";
import {
  BACKOFF_BASE_SECS,
  BACKOFF_MAX_SECS,
  LEASE_SECS,
  MAX_EVENTS_PER_RUN,
  PER_SECTION_BATCH,
  REVALIDATE_MIN_CERTIFICATES,
  REVALIDATE_MIN_DNS,
  REVALIDATE_MIN_HEADERS,
  REVALIDATE_MIN_HOSTING,
  REVALIDATE_MIN_REGISTRATION,
  REVALIDATE_MIN_SEO,
} from "@/lib/constants";
import { ns, redis } from "@/lib/redis";
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

function backoffMsForAttempts(attempts: number): number {
  const baseSecs = BACKOFF_BASE_SECS;
  const maxSecs = BACKOFF_MAX_SECS;
  const secs = Math.min(
    maxSecs,
    Math.max(baseSecs, baseSecs * 2 ** Math.max(0, attempts - 1)),
  );
  return secs * 1000;
}

export async function scheduleSectionIfEarlier(
  section: Section,
  domain: string,
  dueAtMs: number,
  lastAccessedAt?: Date | null,
): Promise<boolean> {
  // Check if domain should stop being revalidated due to inactivity
  if (shouldStopRevalidation(section, lastAccessedAt ?? null)) {
    // Don't schedule - domain is too inactive
    console.info(
      `[schedule] skip ${section} ${domain} (stopped: inactive ${lastAccessedAt ? `since ${lastAccessedAt.toISOString()}` : "never accessed"})`,
    );
    return false;
  }

  // Apply decay multiplier to the due time
  const decayMultiplier = getDecayMultiplier(section, lastAccessedAt ?? null);
  if (decayMultiplier === null) {
    // This shouldn't happen as shouldStopRevalidation would catch it, but be safe
    console.warn(`[schedule] unexpected null decay for ${section} ${domain}`);
    return false;
  }

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
      `[schedule] decay ${section} ${domain} (${decayMultiplier}x, inactive ${daysInactive ? `${daysInactive}d` : "unknown"})`,
    );
  }

  // Validate dueAtMs before any computation or Redis writes
  if (!Number.isFinite(decayedDueMs) || decayedDueMs < 0) {
    return false;
  }
  const minDueMs = now + minTtlSecondsForSection(section) * 1000;
  const desired = Math.max(decayedDueMs, minDueMs);

  const dueKey = ns("due", section);
  let current: number | null = null;
  try {
    const score = await redis.zscore(dueKey, domain);
    current = typeof score === "number" ? score : null;
  } catch {
    current = null;
  }
  if (typeof current === "number" && current <= desired) {
    return false;
  }
  await redis.zadd(dueKey, { score: desired, member: domain });
  return true;
}

export async function scheduleSectionsForDomain(
  domain: string,
  sections: Array<{ section: Section; dueAtMs: number }>,
  lastAccessedAt?: Date | null,
): Promise<void> {
  await Promise.all(
    sections.map((s) =>
      scheduleSectionIfEarlier(s.section, domain, s.dueAtMs, lastAccessedAt),
    ),
  );
}

/**
 * Schedules sections soon; actual run time is bounded by each section's min TTL.
 */
export async function scheduleImmediate(
  domain: string,
  sections: Section[],
  delayMs: number = 1000,
  lastAccessedAt?: Date | null,
): Promise<void> {
  const now = Date.now();
  await scheduleSectionsForDomain(
    domain,
    sections.map((s) => ({ section: s, dueAtMs: now + delayMs })),
    lastAccessedAt,
  );
}

export async function recordFailureAndBackoff(
  section: Section,
  domain: string,
): Promise<number> {
  const taskKey = ns("task", section);
  let attempts = 0;
  try {
    const res = await redis.hincrby(taskKey, domain, 1);
    attempts = typeof res === "number" ? res : 1;
  } catch {
    attempts = 1;
  }
  const nextAtMs = Date.now() + backoffMsForAttempts(attempts);

  // Batch the zadd operation with any future parallel work
  // (for now just one operation, but keeping pattern consistent)
  await redis.zadd(ns("due", section), { score: nextAtMs, member: domain });
  return nextAtMs;
}

export async function resetFailureBackoff(
  section: Section,
  domain: string,
): Promise<void> {
  const taskKey = ns("task", section);
  try {
    await redis.hdel(taskKey, domain);
  } catch {}
}

export function allSections(): Section[] {
  return SectionEnum.options as Section[];
}

export function getLeaseSeconds(): number {
  return LEASE_SECS;
}

type DueDrainResult = {
  events: Array<{
    name: string;
    data: { domain: string; sections: Section[] };
  }>;
  groups: number;
};

/**
 * Drains due domains from Redis sorted sets and builds revalidation events.
 * Used by the Vercel cron job to trigger section revalidation via Inngest.
 */
export async function drainDueDomainsOnce(): Promise<DueDrainResult> {
  const sections = allSections();
  const perSectionBatch = PER_SECTION_BATCH;
  const globalMax = MAX_EVENTS_PER_RUN;
  const leaseSecs = getLeaseSeconds();

  let eventsSent = 0;
  const domainToSections = new Map<string, Set<Section>>();

  for (const section of sections) {
    if (eventsSent >= globalMax) break;
    const dueKey = ns("due", section);
    const now = Date.now();

    const remaining = Math.max(0, globalMax - eventsSent);
    if (remaining === 0) break;

    const fetchCount = Math.min(perSectionBatch, remaining);

    // Pull a small window of due domains
    const dueMembers = (await redis.zrange(dueKey, 0, now, {
      byScore: true,
      offset: 0,
      count: fetchCount,
    })) as string[];
    if (!dueMembers.length) continue;

    // Batch lease acquisitions using pipeline for efficiency
    const pipeline = redis.pipeline();
    const leaseKeys = dueMembers.map((domain) => ns("lease", section, domain));

    for (const leaseKey of leaseKeys) {
      pipeline.set(leaseKey, "1", { nx: true, ex: leaseSecs });
    }

    const leaseResults = await pipeline.exec<Array<string | null>>();

    // Process results and track which domains got leases
    for (let i = 0; i < dueMembers.length; i++) {
      const domain = dueMembers[i];
      const leaseAcquired = leaseResults[i] === "OK";

      if (!leaseAcquired) continue;

      const previouslySelected = domainToSections.has(domain);
      if (!previouslySelected && eventsSent >= globalMax) continue;

      // Enforce global budget at selection time: increment when first selecting a domain
      if (!previouslySelected) {
        eventsSent += 1;
      }

      const set = domainToSections.get(domain) ?? new Set<Section>();
      set.add(section);
      domainToSections.set(domain, set);
    }
  }

  const grouped = Array.from(domainToSections.entries());
  const events: Array<{
    name: string;
    data: { domain: string; sections: Section[] };
  }> = grouped.map(([domain, set]) => ({
    name: "section/revalidate",
    data: { domain, sections: Array.from(set) },
  }));

  return { events, groups: grouped.length };
}
