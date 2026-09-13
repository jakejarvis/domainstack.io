import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { settleInBatches } from "@/lib/settle-in-batches";
import { warmDomainWorkflow } from "@/workflows/warm-domains";
import { getRecentlyAccessedDomains } from "@domainstack/db/queries/domains";
import { createLogger } from "@domainstack/logger";

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
  if (request.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const domains = await getRecentlyAccessedDomains(LOOKBACK_HOURS);
    const results = await settleInBatches(domains, START_BATCH_SIZE, (domain) =>
      start(warmDomainWorkflow, [{ domain }]),
    );
    const started = results.filter((r) => r.status === "fulfilled").length;

    const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failures.length > 0) {
      // One representative error is enough to diagnose a systemic failure
      // (auth, rate limit, outage) without logging thousands of entries.
      logger.warn(
        { failed: failures.length, total: domains.length, err: failures[0].reason },
        "Some workflow starts failed",
      );
    }

    logger.info({ started, total: domains.length }, "Warm domains completed");
    return NextResponse.json({ started });
  } catch (err) {
    logger.error({ err }, "Warm domains failed");
    return NextResponse.json({ error: "Failed to warm domains" }, { status: 500 });
  }
}
