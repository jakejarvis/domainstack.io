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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  let isAuthenticated = false;
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    isAuthenticated = !!session?.user?.id;
  } catch (err) {
    logger.debug({ err }, "auth session check failed, treating as anonymous");
  }

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
    const error = err instanceof Error ? err : new Error(String(err));
    const gone =
      error.message.includes("400") ||
      error.message.includes("Bad Request") ||
      error.message.includes("not found") ||
      error.message.includes("expired");

    if (gone) {
      logger.debug({ runId }, "chat stream no longer available");
      return NextResponse.json(
        { error: "Chat session not found or expired" },
        { status: 404, headers: { ...rateLimit.headers } },
      );
    }

    logger.error({ err, runId }, "failed to reconnect to chat stream");
    return NextResponse.json(
      { error: "Failed to reconnect to chat. Please try again." },
      { status: 500, headers: { ...rateLimit.headers } },
    );
  }
}
