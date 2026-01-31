import { getUserIdsWithEndingSubscriptions } from "@domainstack/db/queries";
import { createLogger } from "@domainstack/logger";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { subscriptionExpiryWorkflow } from "@/workflows/subscription-expiry";

const logger = createLogger({ source: "cron/check-subscription-expiry" });

/**
 * Cron job to check subscription expiry and send notifications.
 */
export async function GET(request: Request) {
  if (
    request.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ids = await getUserIdsWithEndingSubscriptions();
    const results = await Promise.allSettled(
      ids.map((id) => start(subscriptionExpiryWorkflow, [{ userId: id }])),
    );
    const started = results.filter((r) => r.status === "fulfilled").length;

    logger.info(
      { started, total: ids.length },
      "Check subscription expiry completed",
    );
    return NextResponse.json({ started });
  } catch (err) {
    logger.error({ err }, "Check subscription expiry failed");
    return NextResponse.json(
      { error: "Failed to check subscription expiry" },
      { status: 500 },
    );
  }
}
