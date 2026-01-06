import { NextResponse } from "next/server";
import { getRun, start } from "workflow/api";
import { toRegistrableDomain } from "@/lib/domain-server";
import { createLogger } from "@/lib/logger/server";
import {
  type RegistrationWorkflowResult,
  registrationWorkflow,
} from "@/workflows/registration/workflow";

const logger = createLogger({ source: "workflow-registration-api" });

/**
 * POST /api/workflow/registration
 * Start a new registration workflow for a domain.
 *
 * Request body: { domain: string }
 * Response: { runId: string, domain: string, status: string }
 *
 * The workflow runs asynchronously and can be polled for status.
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

    // Start the registration workflow
    const run = await start(registrationWorkflow, [
      { domain: registrableDomain },
    ]);

    logger.info(
      { domain: registrableDomain, runId: run.runId },
      "registration workflow started",
    );

    return NextResponse.json({
      runId: run.runId,
      domain: registrableDomain,
      status: "started",
    });
  } catch (error) {
    logger.error({ err: error }, "failed to start registration workflow");
    return NextResponse.json(
      { error: "Failed to start registration workflow" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/workflow/registration?runId=xxx
 * Check the status of a registration workflow run.
 *
 * Query params: runId (required)
 * Response: { runId: string, status: string, result?: RegistrationWorkflowResult }
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

    // Get the Run object for this runId
    const run = getRun<RegistrationWorkflowResult>(runId);

    // Get the status
    const status = await run.status;

    // If completed, get the result
    if (status === "completed") {
      const result = await run.returnValue;
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
    logger.error({ err: error }, "failed to get registration workflow status");
    return NextResponse.json(
      { error: "Failed to get workflow status" },
      { status: 500 },
    );
  }
}
