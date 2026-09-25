import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { startInBatches } from "@/lib/batch";
import { isCronAuthorized } from "@/lib/cron";
import { getVerifiedTrackedDomainIds } from "@domainstack/db/queries/tracked-domains";
import { createLogger } from "@domainstack/logger";
import { expiryWorkflow } from "@domainstack/workflows/expiry";

const logger = createLogger({ source: "cron/check-expiry" });

/** Max concurrent workflow starts per invocation. */
const START_BATCH_SIZE = 50;

/**
 * Cron job to check domain and certificate expiry and send notifications.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ids = await getVerifiedTrackedDomainIds();
    const started = await startInBatches(
      ids,
      START_BATCH_SIZE,
      (id) => start(expiryWorkflow, [{ trackedDomainId: id }]),
      logger,
    );

    logger.info({ started, total: ids.length }, "Check expiry completed");
    return NextResponse.json({ started });
  } catch (err) {
    logger.error({ err }, "Check expiry failed");
    return NextResponse.json({ error: "Failed to check expiry" }, { status: 500 });
  }
}
