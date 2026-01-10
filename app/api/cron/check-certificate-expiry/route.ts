import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { getVerifiedTrackedDomainIdsWithCertificates } from "@/lib/db/repos/certificates";
import { createLogger } from "@/lib/logger/server";
import { withConcurrencyHandling } from "@/lib/workflow";
import { certificateExpiryWorkflow } from "@/workflows/certificate-expiry";

const logger = createLogger({ source: "cron/check-certificate-expiry" });

// Process domains in batches
const BATCH_SIZE = 50;

/**
 * Cron job to check certificate expiry and send notifications.
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
    logger.info("Starting check certificate expiry cron job");

    const trackedDomainIds =
      await getVerifiedTrackedDomainIdsWithCertificates();

    if (trackedDomainIds.length === 0) {
      logger.info("No domains with certificates to check");
      return NextResponse.json({ scheduled: 0, successful: 0, failed: 0 });
    }

    const results: { id: string; success: boolean }[] = [];

    // Process in batches
    for (let i = 0; i < trackedDomainIds.length; i += BATCH_SIZE) {
      const batch = trackedDomainIds.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (id) => {
          try {
            const run = await start(certificateExpiryWorkflow, [
              { trackedDomainId: id },
            ]);
            // Handle concurrency conflicts gracefully (returns undefined if another worker handled it)
            await withConcurrencyHandling(run.returnValue, {
              trackedDomainId: id,
              workflow: "certificate-expiry",
            });
            return { id, success: true };
          } catch (err) {
            logger.error(
              { trackedDomainId: id, err },
              "Failed to run certificate expiry workflow",
            );
            return { id, success: false };
          }
        }),
      );

      results.push(...batchResults);
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    logger.info(
      { scheduled: trackedDomainIds.length, successful, failed },
      "Check certificate expiry completed",
    );

    return NextResponse.json({
      scheduled: trackedDomainIds.length,
      successful,
      failed,
    });
  } catch (err) {
    logger.error({ err }, "Check certificate expiry failed");
    return NextResponse.json(
      { error: "Failed to check certificate expiry" },
      { status: 500 },
    );
  }
}
