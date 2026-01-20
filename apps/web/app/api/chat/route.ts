/**
 * Chat API routes for domain intelligence queries.
 *
 * POST /api/chat - Start a chat workflow and stream the response
 *
 * Uses the Workflow SDK's DurableAgent for:
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

import { ipAddress } from "@vercel/functions";
import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  MAX_CONVERSATION_MESSAGES,
  MAX_MESSAGE_LENGTH,
  RATE_LIMIT_ANONYMOUS,
  RATE_LIMIT_AUTHENTICATED,
} from "@/lib/constants/ai";
import { createLogger } from "@/lib/logger/server";
import { checkRateLimit } from "@/lib/ratelimit/api";
import { chatWorkflow } from "@/workflows/chat";

const logger = createLogger({ source: "api/chat" });

/**
 * Zod schema for chat request validation.
 *
 * Validates:
 * - Message array exists and isn't too long
 * - Each message has required fields
 * - Text content doesn't exceed max length
 * - Domain is a reasonable string if provided
 */
const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        id: z.string(),
        role: z.enum(["user", "assistant", "system"]),
        parts: z.array(
          z.union([
            z.object({
              type: z.literal("text"),
              text: z.string().max(MAX_MESSAGE_LENGTH, {
                message: `Message text exceeds ${MAX_MESSAGE_LENGTH} characters`,
              }),
            }),
            // Allow other part types (tool calls, etc.) to pass through
            z
              .object({ type: z.string() })
              .passthrough(),
          ]),
        ),
        // Allow additional fields from UIMessage
      }),
    )
    .min(1, { message: "At least one message is required" })
    .max(MAX_CONVERSATION_MESSAGES * 2, {
      message: `Too many messages (max ${MAX_CONVERSATION_MESSAGES * 2})`,
    }),
  domain: z.string().max(253, { message: "Domain name too long" }).optional(),
});

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
  const rateLimitConfig = userId
    ? RATE_LIMIT_AUTHENTICATED.chat
    : RATE_LIMIT_ANONYMOUS.chat;

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
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400, headers: rateLimit.headers },
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
      { status: 400, headers: rateLimit.headers },
    );
  }

  const { messages: rawMessages, domain } = parseResult.data;

  // Truncate conversation history to prevent abuse
  // Keep most recent messages, always including the last user message
  const messages = rawMessages.slice(-MAX_CONVERSATION_MESSAGES) as UIMessage[];

  // Get IP for rate limiting in tools
  const ip = ipAddress(request) ?? null;

  // Start the chat workflow with serializable inputs only
  try {
    const run = await start(chatWorkflow, [{ messages, domain, ip, userId }]);

    // Return streaming response
    return createUIMessageStreamResponse({
      stream: run.readable,
      headers: {
        "x-workflow-run-id": run.runId,
        ...rateLimit.headers,
      },
    });
  } catch (err) {
    logger.error({ err, domain }, "failed to start chat workflow");
    return NextResponse.json(
      { error: "Failed to start chat. Please try again." },
      { status: 500, headers: rateLimit.headers },
    );
  }
}
