import { NextResponse } from "next/server";
import { start, getRunStatus, getRunResult } from "workflow/api";
import { toRegistrableDomain } from "@/lib/domain-server";
import { createLogger } from "@/lib/logger/server";
import {
  screenshotWorkflow,
  type ScreenshotWorkflowResult,
} from "@/workflows/screenshot/workflow";

const logger = createLogger({ source: "workflow-screenshot-api" });

/**
 * POST /api/workflow/screenshot
 * Start a new screenshot workflow for a domain.
 *
 * Request body: { domain: string }
 * Response: { runId: string, status: string }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { domain?: string };

    if (!body.domain || typeof body.domain !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'domain' parameter" },
        { status: 400 },
      );
    }

    const registrableDomain = toRegistrableDomain(body.domain);
    if (!registrableDomain) {
      return NextResponse.json(
        { error: "Invalid domain: must be a registrable domain" },
        { status: 400 },
      );
    }

    // Start the screenshot workflow
    const run = await start(screenshotWorkflow, [{ domain: registrableDomain }]);

    logger.info(
      { domain: registrableDomain, runId: run.id },
      "screenshot workflow started",
    );

    return NextResponse.json({
      runId: run.id,
      domain: registrableDomain,
      status: "started",
    });
  } catch (error) {
    logger.error({ err: error }, "failed to start screenshot workflow");
    return NextResponse.json(
      { error: "Failed to start screenshot workflow" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/workflow/screenshot?runId=xxx
 * Check the status of a screenshot workflow run.
 *
 * Query params: runId (required)
 * Response: { runId: string, status: string, result?: ScreenshotWorkflowResult }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get("runId");

    if (!runId) {
      return NextResponse.json(
        { error: "Missing 'runId' query parameter" },
        { status: 400 },
      );
    }

    // Get the status of the workflow run
    const status = await getRunStatus(runId);

    if (!status) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // If completed, get the result
    if (status === "completed") {
      const result = await getRunResult<ScreenshotWorkflowResult>(runId);
      return NextResponse.json({
        runId,
        status,
        result,
      });
    }

    return NextResponse.json({
      runId,
      status,
    });
  } catch (error) {
    logger.error({ err: error }, "failed to get screenshot workflow status");
    return NextResponse.json(
      { error: "Failed to get workflow status" },
      { status: 500 },
    );
  }
}
