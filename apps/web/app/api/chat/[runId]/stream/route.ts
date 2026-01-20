/**
 * Chat stream reconnection endpoint.
 *
 * GET /api/chat/:runId/stream?startIndex=N
 *
 * Allows clients to reconnect to an interrupted chat stream.
 * Used by WorkflowChatTransport for automatic recovery from
 * network issues or Vercel Function timeouts.
 */

import { createUIMessageStreamResponse } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { getRun } from "workflow/api";
import { auth } from "@/lib/auth";
import {
  RATE_LIMIT_ANONYMOUS,
  RATE_LIMIT_AUTHENTICATED,
} from "@/lib/constants/ai";
import { createLogger } from "@/lib/logger/server";
import { checkRateLimit } from "@/lib/ratelimit/api";

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
  } catch {
    // Auth error - treat as anonymous
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
  const startIndexParam = request.nextUrl.searchParams.get("startIndex");
  const startIndex = startIndexParam ? Number.parseInt(startIndexParam, 10) : 0;

  try {
    const run = getRun(runId);

    // Check if run exists by checking status
    const status = await run.status;
    if (status === "failed") {
      return NextResponse.json(
        { error: "Workflow failed" },
        {
          status: 500,
          headers: rateLimit.headers,
        },
      );
    }

    // Get readable stream from the specified index
    const readable = run.getReadable({ startIndex });

    // Return streaming response using AI SDK's createUIMessageStreamResponse
    // This properly serializes UIMessageChunk objects for HTTP streaming
    return createUIMessageStreamResponse({
      stream: readable,
      headers: rateLimit.headers,
    });
  } catch (err) {
    logger.warn({ err, runId }, "failed to reconnect to chat stream");
    return NextResponse.json(
      { error: "Run not found" },
      {
        status: 404,
        headers: rateLimit.headers,
      },
    );
  }
}
