import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { trackedDomainsRepo } from "@/lib/db/repos";
import { createLogger } from "@/lib/logger/server";
import { domainExpiryWorkflow } from "@/workflows/domain-expiry";

const logger = createLogger({ source: "cron/check-domain-expiry" });

/**
 * Cron job to check domain expiry and send notifications.
 */
export async function GET(request: Request) {
  if (
    request.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ids = await trackedDomainsRepo.getVerifiedTrackedDomainIds();
    const results = await Promise.allSettled(
      ids.map((id) => start(domainExpiryWorkflow, [{ trackedDomainId: id }])),
    );
    const started = results.filter((r) => r.status === "fulfilled").length;

    logger.info(
      { started, total: ids.length },
      "Check domain expiry completed",
    );
    return NextResponse.json({ started });
  } catch (err) {
    logger.error({ err }, "Check domain expiry failed");
    return NextResponse.json(
      { error: "Failed to check domain expiry" },
      { status: 500 },
    );
  }
}
