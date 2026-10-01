/**
 * Chat workflow using WorkflowAgent for domain intelligence queries.
 *
 * Features:
 * - Durable tool execution with automatic retries
 * - Streaming responses via getWritable()
 * - Resumable streams for client reconnection
 *
 * IMPORTANT: This workflow uses only serializable inputs.
 * Node.js modules are imported inside "use step" functions.
 */

import type { GatewayProviderOptions } from "@ai-sdk/gateway";
import { type ModelCallStreamPart, WorkflowAgent } from "@ai-sdk/workflow";
import { convertToModelMessages, isStepCount, type UIMessage } from "ai";
import { getWorkflowMetadata, getWritable } from "workflow";

import { CHAT_RUN_TIMEOUT_MS, MAX_OUTPUT_TOKENS, MAX_TOOL_STEPS } from "@domainstack/constants";

import { captureChatTelemetryStep, toChatTelemetryPayload } from "./telemetry";
import { createDomainToolset, createDomainToolsContext } from "./tools";

/** Fixed client-safe texts: never forward the provider's own error message. */
const CHAT_ERROR_TEXT = "Chat model request failed";
const CHAT_TIMEOUT_TEXT = "Chat run timed out";

interface ChatWorkflowInput {
  messages: UIMessage[];
  domain?: string;
  /** IP address for rate limiting - must be serializable */
  ip: string | null;
  /** User ID for telemetry - must be serializable */
  userId: string | null;
  /** Groups turns of one conversation for AI observability - must be serializable */
  sessionId: string | null;
  /** Resolved in the route handler, before start(), from PostHog Prompt Management */
  systemPrompt: string;
  model: string;
  promptName: string;
  promptVersion: number;
}

/**
 * Chat workflow that uses WorkflowAgent for streaming responses.
 * Single-turn pattern: client owns conversation history.
 */
export async function chatWorkflow(input: ChatWorkflowInput) {
  "use workflow";

  const {
    messages,
    domain,
    ip,
    userId,
    sessionId,
    systemPrompt,
    model,
    promptName,
    promptVersion,
  } = input;

  const domainTools = createDomainToolset();
  const modelMessages = await convertToModelMessages(messages, {
    tools: domainTools,
    ignoreIncompleteToolCalls: true,
  });
  const { workflowRunId } = getWorkflowMetadata();

  const agent = new WorkflowAgent({
    model,
    tools: { ...domainTools },
    instructions: systemPrompt,
    // Temperature 0 ensures consistent tool calling behavior across models
    // See: https://ai-sdk.dev/docs/ai-sdk-core/prompt-engineering#temperature-settings
    temperature: 0,
    headers: {
      // Opt into the Vercel leaderboard: https://vercel.com/docs/ai-gateway/app-attribution
      "http-referer": "https://domainstack.io",
      "x-title": "Domainstack",
    },
    providerOptions: {
      gateway: {
        user: userId ?? ip ?? "",
      } satisfies GatewayProviderOptions,
    },
    toolsContext: createDomainToolsContext({ ip, userId: userId ?? null }),
  });

  const writable = getWritable<ModelCallStreamPart>();
  const result = await agent.stream({
    messages: modelMessages,
    writable,
    stopWhen: isStepCount(MAX_TOOL_STEPS),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    timeout: CHAT_RUN_TIMEOUT_MS,
    onError: async ({ error }) => {
      await logChatAgentErrorStep({
        name: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error),
      });
      await writeChatErrorStep(writable, CHAT_ERROR_TEXT);
    },
    onAbort: async () => {
      await writeChatErrorStep(writable, CHAT_TIMEOUT_TEXT);
    },
  });

  await captureChatTelemetryStep(
    toChatTelemetryPayload({
      sessionId,
      userId,
      workflowRunId,
      domain,
      modelId: model,
      promptName,
      promptVersion,
      tools: Object.keys(domainTools),
      messages: modelMessages,
      systemPrompt,
      steps: result.steps,
    }),
  );

  return { messages: result.messages };
}

async function logChatAgentErrorStep(error: { name: string; message: string }) {
  "use step";
  const { createLogger } = await import("@domainstack/logger");
  const logger = createLogger({ source: "chat/workflow" });
  logger.error(error, "chat agent failed");
}

/** Step: tell the client the turn failed. The SDK closes the stream right after. */
async function writeChatErrorStep(
  writable: WritableStream<ModelCallStreamPart>,
  errorText: string,
) {
  "use step";
  const writer = writable.getWriter();
  try {
    await writer.write({ type: "error", error: errorText });
  } finally {
    writer.releaseLock();
  }
}
