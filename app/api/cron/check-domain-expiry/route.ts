import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { getVerifiedTrackedDomainIds } from "@/lib/db/repos/tracked-domains";
import { createLogger } from "@/lib/logger/server";
import { domainExpiryWorkflow } from "@/workflows/domain-expiry";

const logger = createLogger({ source: "cron/check-domain-expiry" });

// Process domains in batches
const BATCH_SIZE = 50;

/**
 * Cron job to check domain expiry and send notifications.
 * Schedule: Daily at 9:00 AM UTC
 */
export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    logger.info("Starting check domain expiry cron job");

    const verifiedDomainIds = await getVerifiedTrackedDomainIds();

    if (verifiedDomainIds.length === 0) {
      logger.info("No verified domains to check");
      return NextResponse.json({ scheduled: 0, successful: 0, failed: 0 });
    }

    const results: { id: string; success: boolean }[] = [];

    // Process in batches
    for (let i = 0; i < verifiedDomainIds.length; i += BATCH_SIZE) {
      const batch = verifiedDomainIds.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (id) => {
          try {
            const run = await start(domainExpiryWorkflow, [
              { trackedDomainId: id },
            ]);
            await run.returnValue;
            return { id, success: true };
          } catch (err) {
            logger.error(
              { trackedDomainId: id, err },
              "Failed to run domain expiry workflow",
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
      { scheduled: verifiedDomainIds.length, successful, failed },
      "Check domain expiry completed",
    );

    return NextResponse.json({
      scheduled: verifiedDomainIds.length,
      successful,
      failed,
    });
  } catch (err) {
    logger.error({ err }, "Check domain expiry failed");
    return NextResponse.json(
      { error: "Failed to check domain expiry" },
      { status: 500 },
    );
  }
}
