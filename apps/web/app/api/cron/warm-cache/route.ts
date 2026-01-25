import { NextResponse } from "next/server";
import { start } from "workflow/api";
import type { Section } from "@/lib/constants/sections";
import { sections } from "@/lib/constants/sections";
import { getCachedCertificates } from "@/lib/db/repos/certificates";
import { getCachedDns } from "@/lib/db/repos/dns";
import { getRecentlyAccessedDomains } from "@/lib/db/repos/domains";
import { getCachedHeaders } from "@/lib/db/repos/headers";
import { getCachedHosting } from "@/lib/db/repos/hosting";
import { getCachedRegistration } from "@/lib/db/repos/registrations";
import { getCachedSeo } from "@/lib/db/repos/seo";
import { createLogger } from "@/lib/logger/server";
import { certificatesWorkflow } from "@/workflows/certificates";
import { dnsWorkflow } from "@/workflows/dns";
import { headersWorkflow } from "@/workflows/headers";
import { hostingWorkflow } from "@/workflows/hosting";
import { registrationWorkflow } from "@/workflows/registration";
import { seoWorkflow } from "@/workflows/seo";

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
  dns: getCachedDns,
  headers: getCachedHeaders,
  hosting: getCachedHosting,
  certificates: getCachedCertificates,
  seo: getCachedSeo,
  registration: getCachedRegistration,
};

/**
 * Lookup map from section to its workflow function.
 * Uses the purpose-built workflows directly for single source of truth.
 */
const sectionWorkflows: Record<
  Section,
  (input: { domain: string }) => Promise<unknown>
> = {
  dns: dnsWorkflow,
  headers: headersWorkflow,
  hosting: hostingWorkflow,
  certificates: certificatesWorkflow,
  seo: seoWorkflow,
  registration: registrationWorkflow,
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

    // Fire off all workflows (fire-and-forget)
    // Workflows are idempotent, so we don't need deduplication
    let sectionsStarted = 0;
    await Promise.all(
      jobs.map(async ({ domain, section }) => {
        try {
          await start(sectionWorkflows[section], [{ domain }]);
          sectionsStarted++;
        } catch (err) {
          // Log but don't fail the cron - other sections may succeed
          logger.error({ domain, section, err }, "Failed to start workflow");
        }
      }),
    );

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
