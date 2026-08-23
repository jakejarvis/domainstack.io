/**
 * Chat API routes for domain intelligence queries.
 *
 * POST /api/chat - Start a chat workflow and stream the response
 *
 * Uses WorkflowAgent for:
 * - Durable tool execution with automatic retries
 * - Streaming responses via getWritable()/getReadable()
 * - Resumable streams for client reconnection after timeouts
 *
 * Security:
 * - Differentiated rate limits (anonymous vs authenticated)
 * - Input validation with Zod
 * - Message count and length limits
 * - Conversation history truncation
 */

import { createModelCallToUIChunkTransform } from "@ai-sdk/workflow";
import { ipAddress } from "@vercel/functions";
import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { chatRequestSchema } from "@/lib/chat/request-schema";
import { checkRateLimit } from "@/lib/ratelimit/api";
import { chatWorkflow } from "@/workflows/chat";
import { auth } from "@domainstack/auth/server";
import {
  MAX_CONVERSATION_MESSAGES,
  RATE_LIMIT_ANONYMOUS,
  RATE_LIMIT_AUTHENTICATED,
} from "@domainstack/constants";
import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "api/chat" });

/**
 * POST /api/chat
 *
 * Start a chat workflow for domain intelligence queries.
 * Returns the streaming response with x-workflow-run-id header for reconnection.
 */
export async function POST(request: Request) {
  // Check authentication status for differentiated rate limits
  let userId: string | null = null;
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    userId = session?.user?.id ?? null;
  } catch (err) {
    // Auth error - treat as anonymous, but log for debugging
    logger.debug({ err }, "auth session check failed, treating as anonymous");
  }

  // Apply rate limits based on auth status
  const rateLimitConfig = userId ? RATE_LIMIT_AUTHENTICATED.chat : RATE_LIMIT_ANONYMOUS.chat;

  const rateLimit = await checkRateLimit(request, {
    name: "api:chat",
    ...rateLimitConfig,
  });

  if (!rateLimit.success) {
    return rateLimit.error;
  }

  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch (err) {
    logger.warn({ err }, "invalid JSON in chat request body");
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400, headers: { ...rateLimit.headers } },
    );
  }

  const parseResult = chatRequestSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return NextResponse.json(
      { error: "Validation failed", details: errors },
      { status: 400, headers: { ...rateLimit.headers } },
    );
  }

  const { messages: rawMessages, domain } = parseResult.data;

  // Truncate conversation history to prevent abuse
  // Keep the most recent messages within limit
  const messages = rawMessages.slice(-MAX_CONVERSATION_MESSAGES) as UIMessage[];

  // Get IP for rate limiting in tools
  const ip = ipAddress(request) ?? null;

  // Start the chat workflow with serializable inputs only
  try {
    const run = await start(chatWorkflow, [{ messages, domain, ip, userId }]);

    // Convert raw ModelCallStreamPart chunks to UI message chunks for the client
    return createUIMessageStreamResponse({
      stream: run.readable.pipeThrough(createModelCallToUIChunkTransform()),
      headers: {
        "x-workflow-run-id": run.runId,
        ...rateLimit.headers,
      },
    });
  } catch (err) {
    logger.error({ err, domain }, "failed to start chat workflow");
    return NextResponse.json(
      { error: "Failed to start chat. Please try again." },
      { status: 500, headers: { ...rateLimit.headers } },
    );
  }
}
