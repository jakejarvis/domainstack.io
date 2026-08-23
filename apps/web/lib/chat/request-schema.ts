import { z } from "zod";

import { MAX_CONVERSATION_MESSAGES, MAX_MESSAGE_LENGTH } from "@domainstack/constants";

const userTextPartSchema = z.object({
  type: z.literal("text"),
  text: z.string().max(MAX_MESSAGE_LENGTH, {
    message: `Message text exceeds ${MAX_MESSAGE_LENGTH} characters`,
  }),
});

const userMessageSchema = z.looseObject({
  id: z.string(),
  role: z.literal("user"),
  parts: z.array(userTextPartSchema),
});

const assistantMessageSchema = z.looseObject({
  id: z.string(),
  role: z.literal("assistant"),
  parts: z.array(z.looseObject({ type: z.string() })),
});

/**
 * Zod schema for chat request validation.
 *
 * User text is capped at MAX_MESSAGE_LENGTH. Assistant parts are passed
 * through so conversation history (model replies, tool calls) is not rejected.
 */
export const chatRequestSchema = z.object({
  messages: z
    .array(z.discriminatedUnion("role", [userMessageSchema, assistantMessageSchema]))
    .min(1, { message: "At least one message is required" })
    .max(MAX_CONVERSATION_MESSAGES * 2, {
      message: `Too many messages (max ${MAX_CONVERSATION_MESSAGES * 2})`,
    }),
  domain: z.string().max(253, { message: "Domain name too long" }).optional(),
});
