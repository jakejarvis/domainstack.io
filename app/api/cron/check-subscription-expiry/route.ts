import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { getUserIdsWithEndingSubscriptions } from "@/lib/db/repos/user-subscription";
import { createLogger } from "@/lib/logger/server";
import { subscriptionExpiryWorkflow } from "@/workflows/subscription-expiry";

const logger = createLogger({ source: "cron/check-subscription-expiry" });

// Process users in batches
const BATCH_SIZE = 50;

/**
 * Cron job to check subscription expiry and send notifications.
 * Schedule: Daily at 9:30 AM UTC
 */
export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    logger.info("Starting check subscription expiry cron job");

    const userIds = await getUserIdsWithEndingSubscriptions();

    if (userIds.length === 0) {
      logger.info("No users with ending subscriptions to check");
      return NextResponse.json({ scheduled: 0, successful: 0, failed: 0 });
    }

    const results: { id: string; success: boolean }[] = [];

    // Process in batches
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (id) => {
          try {
            const run = await start(subscriptionExpiryWorkflow, [
              { userId: id },
            ]);
            await run.returnValue;
            return { id, success: true };
          } catch (err) {
            logger.error(
              { userId: id, err },
              "Failed to run subscription expiry workflow",
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
      { scheduled: userIds.length, successful, failed },
      "Check subscription expiry completed",
    );

    return NextResponse.json({
      scheduled: userIds.length,
      successful,
      failed,
    });
  } catch (err) {
    logger.error({ err }, "Check subscription expiry failed");
    return NextResponse.json(
      { error: "Failed to check subscription expiry" },
      { status: 500 },
    );
  }
}
