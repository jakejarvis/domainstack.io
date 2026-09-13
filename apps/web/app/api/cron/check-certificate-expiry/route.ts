import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { settleInBatches } from "@/lib/settle-in-batches";
import { certificateExpiryWorkflow } from "@/workflows/certificate-expiry";
import { getVerifiedTrackedDomainIdsWithCertificates } from "@domainstack/db/queries/certificates";
import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "cron/check-certificate-expiry" });

/** Max concurrent workflow starts per invocation. */
const START_BATCH_SIZE = 50;

/**
 * Cron job to check certificate expiry and send notifications.
 */
export async function GET(request: Request) {
  if (request.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ids = await getVerifiedTrackedDomainIdsWithCertificates();
    const results = await settleInBatches(ids, START_BATCH_SIZE, (id) =>
      start(certificateExpiryWorkflow, [{ trackedDomainId: id }]),
    );
    const started = results.filter((r) => r.status === "fulfilled").length;

    const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failures.length > 0) {
      // One representative error is enough to diagnose a systemic failure
      // (auth, rate limit, outage) without logging thousands of entries.
      logger.warn(
        { failed: failures.length, total: ids.length, err: failures[0].reason },
        "Some workflow starts failed",
      );
    }

    logger.info({ started, total: ids.length }, "Check certificate expiry completed");
    return NextResponse.json({ started });
  } catch (err) {
    logger.error({ err }, "Check certificate expiry failed");
    return NextResponse.json({ error: "Failed to check certificate expiry" }, { status: 500 });
  }
}
