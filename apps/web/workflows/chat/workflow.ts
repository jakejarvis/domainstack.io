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
import { getWorkflowMetadata, getWritable } from "workflow";

import { MAX_OUTPUT_TOKENS, MAX_TOOL_STEPS } from "@domainstack/constants";

import { getModelStep } from "./gateway";
import { buildSystemPromptStep } from "./prompt";
import { createDomainToolset, createDomainToolsContext } from "./tools";

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

  const modelMessages = await convertToModelMessages(messages);
  const systemPrompt = await buildSystemPromptStep(domain);
  const model = await getModelStep();
  const domainTools = createDomainToolset();
  const { workflowRunId } = getWorkflowMetadata();

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
    headers: {
      // Opt into the Vercel leaderboard: https://vercel.com/docs/ai-gateway/app-attribution
      "http-referer": "https://domainstack.io",
      "x-title": "Domainstack",
    },
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
        workflowRunId: true,
      },
    },
    runtimeContext: { userId, ip, domain, workflowRunId },
    toolsContext: createDomainToolsContext({ ip }),
  });

  const writable = getWritable<ModelCallStreamPart>();
  const result = await agent.stream({
    messages: modelMessages,
    writable,
    stopWhen: isStepCount(MAX_TOOL_STEPS),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  });

  return { messages: result.messages };
}
