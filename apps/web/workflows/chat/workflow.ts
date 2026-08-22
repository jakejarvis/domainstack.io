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
import { type OpenAIResponsesProviderOptions, openai } from "@ai-sdk/openai";
import { type ModelCallStreamPart, WorkflowAgent } from "@ai-sdk/workflow";
import { convertToModelMessages, isStepCount, type Tool, type UIMessage } from "ai";
import { getWritable } from "workflow";

import { MAX_OUTPUT_TOKENS, MAX_TOOL_STEPS } from "@domainstack/constants";

import { getModelStep } from "./gateway";
import {
  getToolErrorDetails,
  logChatStepFinishStep,
  logChatStreamErrorStep,
  serializeError,
  summarizeToolCalls,
  summarizeToolResults,
} from "./logging";
import { buildSystemPromptStep } from "./prompt";
import { createDomainToolset } from "./tools";

export interface ChatWorkflowInput {
  messages: UIMessage[];
  domain?: string;
  /** IP address for rate limiting - must be serializable */
  ip: string | null;
  /** User ID for telemetry - must be serializable */
  userId: string | null;
}

/**
 * Chat workflow that uses WorkflowAgent for streaming responses.
 * Single-turn pattern: client owns conversation history.
 */
export async function chatWorkflow(input: ChatWorkflowInput) {
  "use workflow";

  const { messages, domain, ip, userId } = input;

  // Convert UI messages to model messages
  const modelMessages = await convertToModelMessages(messages);

  // Compile system prompt
  const systemPrompt = await buildSystemPromptStep(domain);

  const model = await getModelStep();
  const domainTools = createDomainToolset();
  const domainToolContext = { ip };

  // Create agent with domain tools
  // Per AI SDK best practices: use temperature: 0 for deterministic tool calls
  const agent = new WorkflowAgent({
    model,
    tools: {
      ...domainTools,
      web_search: openai.tools.webSearch({
        searchContextSize: "low",
      }) as Tool,
    },
    instructions: systemPrompt,
    // Temperature 0 ensures consistent tool calling behavior across models
    // See: https://ai-sdk.dev/docs/ai-sdk-core/prompt-engineering#temperature-settings
    temperature: 0,
    providerOptions: {
      gateway: {
        user: userId ?? ip ?? "",
      } satisfies GatewayProviderOptions,
      openai: {
        reasoningEffort: "low",
        reasoningSummary: "auto",
      } satisfies OpenAIResponsesProviderOptions,
    },
    telemetry: {
      functionId: "chatWorkflow",
      includeRuntimeContext: {
        userId: true,
        ip: true,
        domain: true,
      },
    },
    runtimeContext: { userId, ip, domain },
    toolsContext: {
      get_registration: domainToolContext,
      get_dns_records: domainToolContext,
      get_hosting: domainToolContext,
      get_certificates: domainToolContext,
      get_headers: domainToolContext,
      get_seo: domainToolContext,
    },
  });

  // Stream response to workflow output
  // Errors will propagate to the stream and trigger onError on the client
  const writable = getWritable<ModelCallStreamPart>();
  const result = await agent.stream({
    messages: modelMessages,
    writable,
    stopWhen: isStepCount(MAX_TOOL_STEPS),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    onStepEnd: async (step) => {
      const toolCalls = Array.isArray(step.toolCalls) ? step.toolCalls : [];
      const toolResults = Array.isArray(step.toolResults) ? step.toolResults : [];

      await logChatStepFinishStep({
        event: "chat_step_finish",
        domain,
        userId,
        finishReason: step.finishReason,
        usage: step.usage,
        toolCalls: summarizeToolCalls(toolCalls),
        toolResults: summarizeToolResults(toolResults),
      });
    },
    onError: async ({ error }) => {
      const errorDetails = serializeError(error);
      const toolDetails = getToolErrorDetails(error);
      await logChatStreamErrorStep({
        event: "chat_stream_error",
        domain,
        userId,
        error: errorDetails,
        tool: toolDetails,
      });
    },
  });

  return { messages: result.messages };
}
