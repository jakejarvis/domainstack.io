import { checkBotId } from "botid/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRun, start } from "workflow/api";
import { getDomainById } from "@/lib/db/repos/domains";
import { getScreenshotByDomainId } from "@/lib/db/repos/screenshots";
import { createLogger } from "@/lib/logger/server";
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
  // Verify request is from a legitimate browser
  // Returns a 403 response if the request is from a bot
  const verification = await checkBotId();
  if (verification.isBot) {
    logger.warn({ verification }, "bot detected, blocking screenshot request");
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

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
        return NextResponse.json({
          status: "completed",
          cached: true,
          data: { url: cachedScreenshot.url, blocked: false },
        });
      }
    }

    // Cache miss - start workflow (fire-and-forget pattern)
    const run = await start(screenshotWorkflow, [{ domain: domain.name }]);

    logger.debug(
      { domainId, domain: domain.name, runId: run.runId },
      "screenshot workflow started",
    );

    return NextResponse.json({
      status: "running",
      runId: run.runId,
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

      return NextResponse.json({
        status: "completed",
        cached: false,
        success: result.success,
        data: result.data,
        ...(result.success === false && { error: result.error }),
      } as ScreenshotStatusResponse);
    }

    if (status === "failed") {
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
