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

import { checkRateLimit } from "@/lib/ratelimit/api";
import { auth } from "@domainstack/auth/server";
import { RATE_LIMIT_ANONYMOUS, RATE_LIMIT_AUTHENTICATED } from "@domainstack/constants";
import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "api/chat/stream" });

/**
 * GET /api/chat/:runId/stream
 *
 * Reconnect to an existing chat workflow stream.
 * Supports startIndex query param to resume from a specific chunk.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  // Check authentication status for differentiated rate limits
  let isAuthenticated = false;
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    isAuthenticated = !!session?.user?.id;
  } catch (err) {
    // Auth error - treat as anonymous, but log for debugging
    logger.debug({ err }, "auth session check failed, treating as anonymous");
  }

  // Apply rate limits based on auth status
  const rateLimitConfig = isAuthenticated
    ? RATE_LIMIT_AUTHENTICATED.stream
    : RATE_LIMIT_ANONYMOUS.stream;

  const rateLimit = await checkRateLimit(request, {
    name: "api:chat-stream",
    ...rateLimitConfig,
  });

  if (!rateLimit.success) {
    return rateLimit.error;
  }

  const { runId } = await params;
  const rawStartIndex = request.nextUrl.searchParams.get("startIndex") ?? "0";
  // Only accept non-negative decimal integer text. Number() would coerce
  // empty, whitespace, hex, and scientific values into a cursor.
  const startIndex = /^\d+$/.test(rawStartIndex) ? Number(rawStartIndex) : Number.NaN;
  // UI chunk indexes are not 1:1 with raw ModelCallStreamPart indexes.
  // Reject invalid cursors instead of coercing them to 0.
  if (!Number.isSafeInteger(startIndex)) {
    return NextResponse.json(
      { error: "startIndex must be a non-negative safe integer" },
      { status: 400, headers: { ...rateLimit.headers } },
    );
  }

  try {
    const run = getRun(runId);

    // Check if run exists by checking status
    const status = await run.status;
    if (status === "failed") {
      logger.error({ runId }, "chat workflow failed");
      return NextResponse.json(
        { error: "Workflow failed" },
        {
          status: 500,
          headers: { ...rateLimit.headers },
        },
      );
    }

    // Replay raw model-call parts from the start, then skip already-seen UI chunks
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
    // Provide more specific error messages based on error type
    const error = err instanceof Error ? err : new Error(String(err));
    let errorMessage = "Chat session not found or expired";
    let statusCode = 404;

    // Check for workflow run no longer available (400 means run completed/expired)
    // This is expected when the client tries to reconnect after the workflow finished
    if (error.message.includes("400") || error.message.includes("Bad Request")) {
      errorMessage = "Chat session completed or expired.";
      statusCode = 410; // Gone - resource no longer available
    } else if (error.message.includes("timeout")) {
      errorMessage = "Connection timed out. Please try again.";
      statusCode = 408;
    } else if (error.message.includes("network")) {
      errorMessage = "Network error. Please check your connection.";
      statusCode = 502;
    } else if (!error.message.includes("not found") && !error.message.includes("expired")) {
      // Unexpected error - use 500 instead of misleading 404
      errorMessage = "An unexpected error occurred. Please try again.";
      statusCode = 500;
    }

    // Log at appropriate severity: error for 500s, warn/debug for expected errors
    if (statusCode === 500) {
      logger.error({ err, runId, statusCode }, "unexpected error reconnecting to chat stream");
    } else if (statusCode === 410) {
      // 410 Gone is expected when reconnecting to a completed workflow
      logger.debug({ runId, statusCode }, "chat stream reconnection to completed workflow");
    } else {
      logger.warn({ err, runId, statusCode }, "failed to reconnect to chat stream");
    }

    return NextResponse.json(
      { error: errorMessage },
      {
        status: statusCode,
        headers: { ...rateLimit.headers },
      },
    );
  }
}
