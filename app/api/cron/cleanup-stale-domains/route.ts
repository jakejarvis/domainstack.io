import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { createLogger } from "@/lib/logger/server";
import { cleanupStaleDomainsWorkflow } from "@/workflows/cleanup-stale-domains";

const logger = createLogger({ source: "cron/cleanup-stale-domains" });

/**
 * Cron job to clean up stale unverified domains.
 * Schedule: Weekly on Sundays at 3:00 AM UTC
 */
export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    logger.info("Starting cleanup stale domains cron job");

    const run = await start(cleanupStaleDomainsWorkflow, [{}]);
    const result = await run.returnValue;

    logger.info(
      { total: result.total, deleted: result.deleted },
      "Cleanup stale domains completed",
    );

    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, "Cleanup stale domains failed");
    return NextResponse.json(
      { error: "Failed to cleanup stale domains" },
      { status: 500 },
    );
  }
}
