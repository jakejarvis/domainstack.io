import { getVerifiedTrackedDomainIds } from "@domainstack/db/queries";
import { createLogger } from "@domainstack/logger";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { reverifyOwnershipWorkflow } from "@/workflows/reverify-ownership";

const logger = createLogger({ source: "cron/reverify-domains" });

/**
 * Cron job to re-verify existing domains (check ownership retention).
 * Pending domain verification is handled by the auto-verify workflow.
 */
export async function GET(request: Request) {
  if (
    request.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ids = await getVerifiedTrackedDomainIds();
    const results = await Promise.allSettled(
      ids.map((id) =>
        start(reverifyOwnershipWorkflow, [{ trackedDomainId: id }]),
      ),
    );
    const started = results.filter((r) => r.status === "fulfilled").length;

    logger.info({ started, total: ids.length }, "Reverify domains completed");
    return NextResponse.json({ started });
  } catch (err) {
    logger.error({ err }, "Reverify domains failed");
    return NextResponse.json(
      { error: "Failed to reverify domains" },
      { status: 500 },
    );
  }
}
