import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { startInBatches } from "@/lib/batch";
import {
  getUserIdsPastDue,
  getUserIdsWithEndingSubscriptions,
} from "@domainstack/db/queries/user-subscription";
import { createLogger } from "@domainstack/logger";
import { subscriptionDowngradeWorkflow } from "@domainstack/workflows/subscription-downgrade";
import { subscriptionExpiryWorkflow } from "@domainstack/workflows/subscription-expiry";

const logger = createLogger({ source: "cron/check-subscription-expiry" });

/** Max concurrent workflow starts per invocation. */
const START_BATCH_SIZE = 50;

/**
 * Cron job to check subscription expiry and send notifications.
 */
export async function GET(request: Request) {
  if (request.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [endingIds, pastDueIds] = await Promise.all([
      getUserIdsWithEndingSubscriptions(),
      getUserIdsPastDue(),
    ]);

    // Upcoming-expiry reminder emails (7/3/1 days before endsAt) plus a
    // server-side downgrade safety net for users whose paid period elapsed
    // but who are still on `pro` (Polar `subscription.revoked` missed/delayed).
    // Run in sequence so concurrency stays bounded to START_BATCH_SIZE.
    const remindersStarted = await startInBatches(
      endingIds,
      START_BATCH_SIZE,
      (id) => start(subscriptionExpiryWorkflow, [{ userId: id }]),
      logger.child({ kind: "reminders" }),
    );
    const downgradesStarted = await startInBatches(
      pastDueIds,
      START_BATCH_SIZE,
      (id) => start(subscriptionDowngradeWorkflow, [{ userId: id }]),
      logger.child({ kind: "downgrades" }),
    );

    logger.info(
      {
        remindersStarted,
        endingTotal: endingIds.length,
        downgradesStarted,
        pastDueTotal: pastDueIds.length,
      },
      "Check subscription expiry completed",
    );
    return NextResponse.json({ remindersStarted, downgradesStarted });
  } catch (err) {
    logger.error({ err }, "Check subscription expiry failed");
    return NextResponse.json({ error: "Failed to check subscription expiry" }, { status: 500 });
  }
}
