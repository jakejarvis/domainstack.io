import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRun, start } from "workflow/api";
import { analytics } from "@/lib/analytics/server";
import { getDomainById } from "@/lib/db/repos/domains";
import { getScreenshotByDomainId } from "@/lib/db/repos/screenshots";
import { createLogger } from "@/lib/logger/server";
import {
  getDeduplicationKey,
  startWithDeduplication,
} from "@/lib/workflow/deduplication";
import {
  type ScreenshotWorkflowResult,
  screenshotWorkflow,
} from "@/workflows/screenshot";

const logger = createLogger({ source: "screenshot-api" });

/**
 * Response types for the screenshot API
 */
type ScreenshotStartResponse =
  | {
      status: "completed";
      cached: true;
      data: { url: string | null; blocked: boolean };
    }
  | { status: "running"; runId: string };

type ScreenshotStatusResponse =
  | { status: "running" }
  | {
      status: "completed";
      cached: false;
      success: true;
      data: { url: string | null; blocked?: boolean };
    }
  | {
      status: "completed";
      cached: false;
      success: false;
      error: string;
      data: { url: null };
    }
  | { status: "failed"; error: string };

/**
 * POST /api/screenshot
 *
 * Start a screenshot workflow for a domain.
 * Accepts { domainId: string } in the request body.
 * Returns cached result immediately if available, otherwise starts workflow.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ScreenshotStartResponse | { error: string }>> {
  try {
    const body = await request.json();
    const { domainId } = body as { domainId?: string };

    if (!domainId || typeof domainId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid domainId" },
        { status: 400 },
      );
    }

    // Look up domain by ID (security check - domain must exist)
    const domain = await getDomainById(domainId);

    if (!domain) {
      logger.warn({ domainId }, "screenshot requested for unknown domain");
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    // Check cache first
    const cachedScreenshot = await getScreenshotByDomainId(domainId);

    if (cachedScreenshot) {
      // Only treat as cache hit if we have a definitive result:
      // - url is present (string), OR
      // - url is null but marked as permanently not found
      const isDefinitiveResult =
        cachedScreenshot.url !== null || cachedScreenshot.notFound === true;

      if (isDefinitiveResult) {
        // Check current block status dynamically
        let blocked = false;
        if (cachedScreenshot.url) {
          try {
            // We already have the domain name, no need to parse URL
            const domainName = domain.name;

            // Import and check block status
            const { isDomainBlocked } = await import(
              "@/lib/db/repos/blocked-domains"
            );
            blocked = await isDomainBlocked(domainName);
          } catch {
            // Fall back to false if check fails
            blocked = false;
          }
        }

        analytics.track("screenshot_api_cache_hit", {
          domain: domain.name,
        });

        return NextResponse.json({
          status: "completed",
          cached: true,
          data: { url: cachedScreenshot.url, blocked },
        });
      }
    }

    // Cache miss - start workflow with deduplication
    // (prevents duplicate workflows if multiple requests arrive simultaneously)
    const key = getDeduplicationKey("screenshot", domain.name);
    const result = await startWithDeduplication(
      key,
      async () => {
        const run = await start(screenshotWorkflow, [{ domain: domain.name }]);

        logger.debug(
          { domainId, domain: domain.name, runId: run.runId },
          "screenshot workflow started",
        );

        analytics.track("screenshot_api_workflow_started", {
          domain: domain.name,
          runId: run.runId,
        });

        return {
          runId: run.runId,
          returnValue: run.returnValue,
        };
      },
      {
        // Keep the deduplication entry alive for the duration of the workflow,
        // even though this endpoint returns early with `runId`.
        keepAliveUntil: (r) => r.returnValue,
        // Safety valve to avoid poisoning this key forever if something hangs.
        // Screenshot runs should normally complete much faster than this.
        maxPendingMs: 5 * 60 * 1000,
      },
    );

    return NextResponse.json({
      status: "running",
      runId: result.runId,
    });
  } catch (err) {
    logger.error({ err }, "failed to start screenshot workflow");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/screenshot?runId=xxx
 *
 * Poll for screenshot workflow status.
 * Returns the current status and result when completed.
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<ScreenshotStatusResponse | { error: string }>> {
  const runId = request.nextUrl.searchParams.get("runId");

  if (!runId) {
    return NextResponse.json({ error: "Missing runId" }, { status: 400 });
  }

  try {
    const run = getRun(runId);
    const status = await run.status;

    if (status === "completed") {
      const result = (await run.returnValue) as ScreenshotWorkflowResult;

      analytics.track("screenshot_api_workflow_completed", {
        runId,
        success: result.success,
      });

      return NextResponse.json({
        status: "completed",
        cached: false,
        success: result.success,
        data: result.data,
        ...(result.success === false && { error: result.error }),
      } as ScreenshotStatusResponse);
    }

    if (status === "failed") {
      analytics.track("screenshot_api_workflow_failed", { runId });

      return NextResponse.json({
        status: "failed",
        error: "workflow_failed",
      });
    }

    // Still running
    return NextResponse.json({ status: "running" });
  } catch (err) {
    logger.warn({ err, runId }, "failed to get workflow run status");
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
}
