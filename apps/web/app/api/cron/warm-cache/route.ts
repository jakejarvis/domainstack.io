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
import {
  getDeduplicationKey,
  startDeduplicated,
} from "@/lib/workflow/deduplication";
import { sectionRevalidateWorkflow } from "@/workflows/section-revalidate";

/** All section types */
const ALL_SECTIONS = Object.keys(sections) as Section[];

const logger = createLogger({ source: "cron/warm-cache" });

// Process domains in batches to avoid overwhelming the system
const BATCH_SIZE = 10;

// How many hours back to look for recently accessed domains
const LOOKBACK_HOURS = 24;

/**
 * Check if a section is stale for a given domain.
 */
async function isSectionStale(
  domain: string,
  section: Section,
): Promise<boolean> {
  try {
    switch (section) {
      case "dns": {
        const result = await getCachedDns(domain);
        return result.stale || result.data === null;
      }
      case "headers": {
        const result = await getCachedHeaders(domain);
        return result.stale || result.data === null;
      }
      case "hosting": {
        const result = await getCachedHosting(domain);
        return result.stale || result.data === null;
      }
      case "certificates": {
        const result = await getCachedCertificates(domain);
        return result.stale || result.data === null;
      }
      case "seo": {
        const result = await getCachedSeo(domain);
        return result.stale || result.data === null;
      }
      case "registration": {
        const result = await getCachedRegistration(domain);
        return result.stale || result.data === null;
      }
      default:
        return false;
    }
  } catch {
    // If we can't check, assume stale
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
 * This replaces the previous Inngest-based scheduled revalidation with
 * a simpler approach: instead of scheduling future refreshes after each
 * data persist, we periodically refresh stale data for active domains.
 */
export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  if (
    request.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    logger.info("Starting warm-cache cron job");

    // Get domains accessed in the last 24 hours
    const recentDomains = await getRecentlyAccessedDomains(LOOKBACK_HOURS);

    if (recentDomains.length === 0) {
      logger.info("No recently accessed domains to warm");
      return NextResponse.json({
        domains: 0,
        sectionsRefreshed: 0,
        sectionsSkipped: 0,
      });
    }

    logger.info(
      { count: recentDomains.length },
      "Found recently accessed domains",
    );

    let sectionsRefreshed = 0;
    let sectionsSkipped = 0;

    // Process domains in batches
    for (let i = 0; i < recentDomains.length; i += BATCH_SIZE) {
      const batch = recentDomains.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (domain) => {
          try {
            // Find which sections are stale
            const staleSections = await getStaleSections(domain);

            if (staleSections.length === 0) {
              return; // All sections are fresh
            }

            // Refresh stale sections
            await Promise.all(
              staleSections.map(async (section) => {
                const key = getDeduplicationKey("section-revalidate", domain);
                const { started } = await startDeduplicated(
                  `${key}:${section}`,
                  () => start(sectionRevalidateWorkflow, [{ domain, section }]),
                );

                if (started) {
                  sectionsRefreshed++;
                } else {
                  sectionsSkipped++;
                }
              }),
            );
          } catch (err) {
            logger.error({ domain, err }, "Failed to warm cache for domain");
          }
        }),
      );
    }

    const result = {
      domains: recentDomains.length,
      sectionsRefreshed,
      sectionsSkipped,
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
