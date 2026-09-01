import { z } from "zod";

import {
  MAX_ASSISTANT_PART_CHARS,
  MAX_ASSISTANT_PARTS,
  MAX_ASSISTANT_TEXT_LENGTH,
  MAX_CONVERSATION_MESSAGES,
  MAX_MESSAGE_LENGTH,
} from "@domainstack/constants";

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

const assistantPartSchema = z
  .looseObject({
    type: z.string().max(64, { message: "Assistant part type is too long" }),
  })
  .superRefine((part, ctx) => {
    if (typeof part.text === "string" && part.text.length > MAX_ASSISTANT_TEXT_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Assistant text exceeds ${MAX_ASSISTANT_TEXT_LENGTH} characters`,
        path: ["text"],
      });
    }

    try {
      if (JSON.stringify(part).length > MAX_ASSISTANT_PART_CHARS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Assistant part exceeds ${MAX_ASSISTANT_PART_CHARS} characters`,
        });
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Assistant part could not be serialized",
      });
    }
  });

const assistantMessageSchema = z.looseObject({
  id: z.string(),
  role: z.literal("assistant"),
  parts: z.array(assistantPartSchema).max(MAX_ASSISTANT_PARTS, {
    message: `Too many assistant parts (max ${MAX_ASSISTANT_PARTS})`,
  }),
});

/**
 * Zod schema for chat request validation.
 *
 * User text is capped at MAX_MESSAGE_LENGTH. Assistant parts are passed
 * through so conversation history (model replies, tool calls) is not
 * rejected, but each part is size-capped so client-controlled history
 * cannot inflate context or cost without bound.
 */
export const chatRequestSchema = z.object({
  messages: z
    .array(z.discriminatedUnion("role", [userMessageSchema, assistantMessageSchema]))
    .min(1, { message: "At least one message is required" })
    .max(MAX_CONVERSATION_MESSAGES * 2, {
      message: `Too many messages (max ${MAX_CONVERSATION_MESSAGES * 2})`,
    }),
  domain: z.string().max(253, { message: "Domain name too long" }).optional(),
  sessionId: z.string().max(100, { message: "Session ID too long" }).optional(),
});
