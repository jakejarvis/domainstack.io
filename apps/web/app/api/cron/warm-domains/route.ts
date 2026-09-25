import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { startInBatches } from "@/lib/batch";
import { isCronAuthorized } from "@/lib/cron";
import { getRecentlyAccessedDomains } from "@domainstack/db/queries/domains";
import { createLogger } from "@domainstack/logger";
import { warmDomainWorkflow } from "@domainstack/workflows/warm-domains";

const logger = createLogger({ source: "cron/warm-domains" });

// How many hours back to look for recently accessed domains
const LOOKBACK_HOURS = 24;

/** Max concurrent workflow starts per invocation. */
const START_BATCH_SIZE = 50;

/**
 * Cron job to keep recently viewed domains' report data warm. Starts one
 * warmDomainWorkflow per domain accessed in the last LOOKBACK_HOURS. Each run
 * decides which sections are missing or expire before the next run, and
 * refreshes them.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const domains = await getRecentlyAccessedDomains(LOOKBACK_HOURS);
    const started = await startInBatches(
      domains,
      START_BATCH_SIZE,
      (domain) => start(warmDomainWorkflow, [{ domain }]),
      logger,
    );

    logger.info({ started, total: domains.length }, "Warm domains completed");
    return NextResponse.json({ started });
  } catch (err) {
    logger.error({ err }, "Warm domains failed");
    return NextResponse.json({ error: "Failed to warm domains" }, { status: 500 });
  }
}
