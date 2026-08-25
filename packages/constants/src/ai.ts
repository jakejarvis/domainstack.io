/**
 * AI Chat Configuration
 *
 * These constants are shared between client and server to ensure
 * consistent validation and limits.
 */

/**
 * Default AI model for the chat endpoint.
 * Can be overridden via Edge Config key: `ai_chat_model`
 *
 * IMPORTANT: For reliable tool calling, use models known to support
 * it well.
 * See: https://vercel.com/ai-gateway/models (Provider support table)
 */
export const DEFAULT_CHAT_MODEL = "google/gemini-2.5-flash";

/**
 * Friendly chatbot name.
 */
export const CHATBOT_NAME = "Stacky";

// =============================================================================
// Chat Limits
// =============================================================================

/**
 * Maximum length of a single message in characters.
 * Enforced on both client (UI) and server (validation).
 */
export const MAX_MESSAGE_LENGTH = 500;

/**
 * Maximum number of messages to send to the API.
 * Older messages are truncated to stay within this limit.
 * This controls context window usage and costs.
 *
 * Note: Server will validate up to 2x this limit to account for
 * user+assistant message pairs in conversation history.
 */
export const MAX_CONVERSATION_MESSAGES = 10;

/**
 * Maximum output tokens the model can generate per response.
 * Prevents runaway responses and controls costs.
 */
export const MAX_OUTPUT_TOKENS = 4096;

/**
 * Maximum characters in a single assistant text/reasoning part.
 * Larger than MAX_MESSAGE_LENGTH because model output can reach
 * MAX_OUTPUT_TOKENS tokens. 8 chars/token leaves headroom for
 * punctuation-heavy or non-English replies.
 */
export const MAX_ASSISTANT_TEXT_LENGTH = MAX_OUTPUT_TOKENS * 8;

/**
 * Maximum JSON-serialized size of a single assistant part.
 * Bounds tool input/output and extra fields on loose parts.
 */
export const MAX_ASSISTANT_PART_CHARS = 64_000;

/**
 * Maximum number of parts on a single assistant message.
 */
export const MAX_ASSISTANT_PARTS = 32;

/**
 * Maximum chat request body size in bytes.
 * Enforced before JSON.parse so oversized payloads never reach
 * the schema or the model.
 */
export const MAX_CHAT_REQUEST_BYTES = 512_000;

/**
 * Maximum number of tool calls (steps) per request.
 * Prevents infinite loops and controls execution time.
 */
export const MAX_TOOL_STEPS = 8;

// =============================================================================
// Rate Limits
// =============================================================================

/**
 * Rate limits for anonymous users (no session).
 * More restrictive to prevent abuse.
 */
export const RATE_LIMIT_ANONYMOUS = {
  /** Requests per window for chat endpoint */
  chat: { requests: 10, window: "1 m" as const },
  /** Requests per window for stream reconnection */
  stream: { requests: 30, window: "1 m" as const },
};

/**
 * Rate limits for authenticated users.
 * More generous limits for logged-in users.
 */
export const RATE_LIMIT_AUTHENTICATED = {
  /** Requests per window for chat endpoint */
  chat: { requests: 30, window: "1 m" as const },
  /** Requests per window for stream reconnection */
  stream: { requests: 90, window: "1 m" as const },
};
