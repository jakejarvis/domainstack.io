/**
 * AI Chat Configuration
 *
 * These constants are shared between client and server to ensure
 * consistent validation and limits.
 */

/**
 * Default AI model for the chat endpoint.
 * Can be overridden via Edge Config key: `ai_chat_model`
 */
export const DEFAULT_CHAT_MODEL = "google/gemini-2.5-flash-lite";

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
