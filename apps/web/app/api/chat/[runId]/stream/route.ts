/**
 * Chat stream reconnection endpoint.
 *
 * GET /api/chat/:runId/stream?startIndex=N
 *
 * Allows clients to reconnect to an interrupted chat stream.
 * Used by WorkflowChatTransport for automatic recovery from
 * network issues or Vercel Function timeouts.
 */

import { createModelCallToUIChunkTransform } from "@ai-sdk/workflow";
import { createUIMessageStreamResponse } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { getRun } from "workflow/api";
import { RunExpiredError, WorkflowRunNotFoundError, WorkflowWorldError } from "workflow/errors";

import { checkRateLimit } from "@/lib/ratelimit/api";
import { auth } from "@domainstack/auth/server";
import { RATE_LIMIT_ANONYMOUS, RATE_LIMIT_AUTHENTICATED } from "@domainstack/constants";
import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "api/chat/stream" });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const paramsPromise = params;

  let userId: string | null = null;
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    userId = session?.user?.id ?? null;
  } catch (err) {
    logger.debug({ err }, "auth session check failed, treating as anonymous");
  }

  const rateLimitConfig = userId ? RATE_LIMIT_AUTHENTICATED.stream : RATE_LIMIT_ANONYMOUS.stream;

  const rateLimit = await checkRateLimit(request, {
    name: "api:chat-stream",
    ...rateLimitConfig,
    identifier: userId,
  });

  if (!rateLimit.success) {
    return rateLimit.error;
  }

  const { runId } = await paramsPromise;
  const rawStartIndex = request.nextUrl.searchParams.get("startIndex") ?? "0";
  const startIndex = /^\d+$/.test(rawStartIndex) ? Number(rawStartIndex) : Number.NaN;
  if (!Number.isSafeInteger(startIndex)) {
    return NextResponse.json(
      { error: "startIndex must be a non-negative safe integer" },
      { status: 400, headers: { ...rateLimit.headers } },
    );
  }

  try {
    const run = getRun(runId);
    const status = await run.status;
    if (status === "failed") {
      logger.error({ runId }, "chat workflow failed");
      return NextResponse.json(
        { error: "Workflow failed" },
        { status: 500, headers: { ...rateLimit.headers } },
      );
    }

    const readable = run
      .getReadable({ startIndex: 0 })
      .pipeThrough(createModelCallToUIChunkTransform({ uiStartIndex: startIndex }));

    return createUIMessageStreamResponse({
      stream: readable,
      headers: {
        "x-workflow-run-id": runId,
        ...rateLimit.headers,
      },
    });
  } catch (err) {
    // Completed runs are reported as a 400 WorkflowWorldError.
    if (WorkflowWorldError.is(err) && err.status === 400) {
      logger.debug({ runId }, "chat stream reconnection to completed workflow");
      return NextResponse.json(
        { error: "Chat session completed or expired." },
        { status: 410, headers: { ...rateLimit.headers } },
      );
    }

    // Missing or expired runs should not be treated as unexpected 500s.
    if (
      WorkflowRunNotFoundError.is(err) ||
      RunExpiredError.is(err) ||
      (err instanceof Error && err.name === "StreamExpiredError") ||
      (WorkflowWorldError.is(err) && (err.status === 404 || err.status === 410))
    ) {
      logger.debug({ runId }, "chat stream reconnection to unavailable workflow");
      return NextResponse.json(
        { error: "Chat session completed or expired." },
        { status: 404, headers: { ...rateLimit.headers } },
      );
    }

    logger.error({ err, runId }, "unexpected error reconnecting to chat stream");
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500, headers: { ...rateLimit.headers } },
    );
  }
}
