import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { certificatesRepo } from "@/lib/db/repos";
import { createLogger } from "@/lib/logger/server";
import { certificateExpiryWorkflow } from "@/workflows/certificate-expiry";

const logger = createLogger({ source: "cron/check-certificate-expiry" });

/**
 * Cron job to check certificate expiry and send notifications.
 */
export async function GET(request: Request) {
  if (
    request.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ids =
      await certificatesRepo.getVerifiedTrackedDomainIdsWithCertificates();
    const results = await Promise.allSettled(
      ids.map((id) =>
        start(certificateExpiryWorkflow, [{ trackedDomainId: id }]),
      ),
    );
    const started = results.filter((r) => r.status === "fulfilled").length;

    logger.info(
      { started, total: ids.length },
      "Check certificate expiry completed",
    );
    return NextResponse.json({ started });
  } catch (err) {
    logger.error({ err }, "Check certificate expiry failed");
    return NextResponse.json(
      { error: "Failed to check certificate expiry" },
      { status: 500 },
    );
  }
}
