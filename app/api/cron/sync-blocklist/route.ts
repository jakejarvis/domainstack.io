import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { createLogger } from "@/lib/logger/server";
import { syncBlocklistWorkflow } from "@/workflows/sync-blocklist";

const logger = createLogger({ source: "cron/sync-blocklist" });

/**
 * Cron job to sync the screenshot blocklist from external sources.
 * Schedule: Weekly on Sundays at 2:00 AM UTC
 */
export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    logger.info("Starting sync blocklist cron job");

    const run = await start(syncBlocklistWorkflow, [{}]);
    const result = await run.returnValue;

    logger.info(
      { sources: result.sources, added: result.added, removed: result.removed },
      "Sync blocklist completed",
    );

    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, "Sync blocklist failed");
    return NextResponse.json(
      { error: "Failed to sync blocklist" },
      { status: 500 },
    );
  }
}
