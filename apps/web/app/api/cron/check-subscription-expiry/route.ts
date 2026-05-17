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
    // Upcoming-expiry reminder emails (7/3/1 days before endsAt).
    const endingIds = await getUserIdsWithEndingSubscriptions();
    const reminderResults = await Promise.allSettled(
      endingIds.map((id) => start(subscriptionExpiryWorkflow, [{ userId: id }])),
    );
    const remindersStarted = reminderResults.filter((r) => r.status === "fulfilled").length;

    // Server-side downgrade safety net: users whose paid period has elapsed
    // but who are still on `pro` (Polar `subscription.revoked` webhook missed
    // or delayed). The workflow re-checks Polar before downgrading.
    //
    // Operational note: the FIRST run after migration 0022 deploys will process
    // the entire already-lapsed pro cohort in one burst — that backfill mapped
    // pro users with a past `ends_at` to a `canceling` billing row with an
    // expired `current_period_end`, so they all qualify here at once and get
    // downgraded + archived + emailed together. This is correct cleanup; expect
    // the spike in `downgradesStarted` / expired emails on that first run.
    const pastDueIds = await getUserIdsPastDue();
    const downgradeResults = await Promise.allSettled(
      pastDueIds.map((id) => start(subscriptionDowngradeWorkflow, [{ userId: id }])),
    );
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
