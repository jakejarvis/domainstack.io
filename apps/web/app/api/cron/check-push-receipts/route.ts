import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { checkPushReceiptsWorkflow } from "@/workflows/check-push-receipts";
import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "cron/check-push-receipts" });

/**
 * Cron job: pulls Expo push receipts for recently-dispatched notifications
 * and applies their delivery status, auto-disabling devices that report
 * `DeviceNotRegistered`.
 */
export async function GET(request: Request) {
  if (request.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await start(checkPushReceiptsWorkflow, []);
    logger.info("Check push receipts started");
    return NextResponse.json({ started: 1 });
  } catch (err) {
    logger.error({ err }, "Check push receipts failed");
    return NextResponse.json({ error: "Failed to check push receipts" }, { status: 500 });
  }
}
