import {
  getCachedCertificates,
  getCachedDns,
  getCachedHeaders,
  getCachedHosting,
  getCachedRegistration,
  getCachedSeo,
  getRecentlyAccessedDomains,
} from "@domainstack/db/queries";
import { createLogger } from "@domainstack/logger";
import {
  fetchCertificates,
  fetchDns,
  fetchHeaders,
  fetchHosting,
  fetchRegistration,
  fetchSeo,
} from "@domainstack/server";
import { NextResponse } from "next/server";
import type { Section } from "@/lib/constants/sections";
import { sections } from "@/lib/constants/sections";

/** All section types */
const ALL_SECTIONS = Object.keys(sections) as Section[];

const logger = createLogger({ source: "cron/warm-cache" });

// How many hours back to look for recently accessed domains
const LOOKBACK_HOURS = 24;

/**
 * Lookup map from section to its cache getter function.
 * Provides compile-time safety: if a new section is added to the Section type,
 * TypeScript will error until it's added here.
 */
const sectionCacheGetters: Record<
  Section,
  (domain: string) => Promise<{ stale: boolean; data: unknown }>
> = {
  dns: (domain) => getCachedDns(domain),
  headers: (domain) => getCachedHeaders(domain),
  hosting: (domain) => getCachedHosting(domain),
  certificates: (domain) => getCachedCertificates(domain),
  seo: (domain) => getCachedSeo(domain),
  registration: (domain) => getCachedRegistration(domain),
};

/**
 * Lookup map from section to its fetch function.
 * Uses the server package services directly.
 */
const sectionFetchers: Record<Section, (domain: string) => Promise<unknown>> = {
  dns: fetchDns,
  headers: fetchHeaders,
  hosting: fetchHosting,
  certificates: fetchCertificates,
  seo: fetchSeo,
  registration: fetchRegistration,
};

/**
 * Check if a section is stale for a given domain.
 */
async function isSectionStale(
  domain: string,
  section: Section,
): Promise<boolean> {
  try {
    const result = await sectionCacheGetters[section](domain);
    return result.stale || result.data === null;
  } catch (err) {
    logger.error(
      { domain, section, err },
      "failed to check staleness, assuming stale",
    );
    return true;
  }
}

/**
 * Get all stale sections for a domain.
 */
async function getStaleSections(domain: string): Promise<Section[]> {
  const staleChecks = await Promise.all(
    ALL_SECTIONS.map(async (section) => ({
      section,
      stale: await isSectionStale(domain, section),
    })),
  );

  return staleChecks
    .filter((c): c is { section: Section; stale: true } => c.stale)
    .map((c) => c.section);
}

/**
 * Cron job to warm the cache for recently-accessed domains.
 *
 * This job proactively refreshes stale data for domains that have been
 * accessed recently, ensuring users get fresh data on their next visit.
 *
 * Fires off workflow starts directly (fire-and-forget). Workflows are
 * idempotent, so duplicates are harmless, and failures just mean data
 * stays stale until next user access.
 */
export async function GET(request: Request) {
  if (
    request.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get domains accessed in the last 24 hours
    const recentDomains = await getRecentlyAccessedDomains(LOOKBACK_HOURS);

    if (recentDomains.length === 0) {
      logger.info("No recently accessed domains to warm");
      return NextResponse.json({
        domains: 0,
        sectionsStarted: 0,
      });
    }

    // Collect all stale sections across all domains
    const jobs: { domain: string; section: Section }[] = [];
    let domainsFailed = 0;

    // Check staleness for all domains in parallel
    await Promise.all(
      recentDomains.map(async (domain) => {
        try {
          const staleSections = await getStaleSections(domain);
          for (const section of staleSections) {
            jobs.push({ domain, section });
          }
        } catch (err) {
          domainsFailed++;
          logger.error({ domain, err }, "Failed to check staleness for domain");
        }
      }),
    );

    if (jobs.length === 0) {
      logger.info("No stale sections to refresh");
      return NextResponse.json({
        domains: recentDomains.length,
        domainsFailed,
        sectionsStarted: 0,
      });
    }

    // Process in batches to avoid overwhelming resources and timeouts
    // Each batch runs concurrently, batches run sequentially
    const BATCH_SIZE = 50;
    let sectionsStarted = 0;

    for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
      const batch = jobs.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async ({ domain, section }) => {
          try {
            await sectionFetchers[section](domain);
            sectionsStarted++;
          } catch (err) {
            // Log but don't fail the cron - other sections may succeed
            logger.error({ domain, section, err }, "Failed to refresh section");
          }
        }),
      );
    }

    const result = {
      domains: recentDomains.length,
      domainsFailed,
      sectionsStarted,
    };

    logger.info(result, "Warm-cache cron completed");

    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, "Warm-cache cron failed");
    return NextResponse.json(
      { error: "Failed to warm cache" },
      { status: 500 },
    );
  }
}
