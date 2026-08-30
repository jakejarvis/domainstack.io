import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { subscriptionDowngradeWorkflow } from "@/workflows/subscription-downgrade";
import { subscriptionExpiryWorkflow } from "@/workflows/subscription-expiry";
import { getUserIdsPastDue, getUserIdsWithEndingSubscriptions } from "@domainstack/db/queries";
import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "cron/check-subscription-expiry" });

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
    const [reminderResults, downgradeResults] = await Promise.all([
      Promise.allSettled(
        endingIds.map((id) => start(subscriptionExpiryWorkflow, [{ userId: id }])),
      ),
      Promise.allSettled(
        pastDueIds.map((id) => start(subscriptionDowngradeWorkflow, [{ userId: id }])),
      ),
    ]);
    const remindersStarted = reminderResults.filter((r) => r.status === "fulfilled").length;
    const downgradesStarted = downgradeResults.filter((r) => r.status === "fulfilled").length;

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
