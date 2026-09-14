/**
 * Captures AI Observability events after a chat turn.
 *
 * Step usage covers prompts, tools, and timings. `getGenerationInfo` overlays
 * the Gateway's billed cost and the provider that actually served the call.
 */

import type { GatewayGenerationInfo } from "@ai-sdk/gateway";
import type { ModelMessage, ProviderMetadata, StepResult, ToolSet } from "ai";

export type GatewayGenerationSnapshot = Pick<
  GatewayGenerationInfo,
  | "model"
  | "providerName"
  | "totalCost"
  | "promptTokens"
  | "completionTokens"
  | "reasoningTokens"
  | "cachedTokens"
  | "cacheCreationTokens"
  | "billableWebSearchCalls"
>;

function isToolError(output: unknown): boolean {
  return typeof output === "object" && output !== null && "error" in output;
}

function readGatewayGenerationId(metadata: ProviderMetadata | undefined): string | undefined {
  const id = metadata?.gateway?.generationId;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

function normalizeProvider(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * Split a Vercel AI Gateway model id (`provider/model`) so PostHog can price
 * tokens. Do not report `gateway` as the provider.
 */
export function parseGatewayModelId(modelId: string): { provider: string; model: string } {
  const slash = modelId.indexOf("/");
  if (slash <= 0 || slash === modelId.length - 1) {
    return { provider: "unknown", model: modelId };
  }

  return {
    provider: modelId.slice(0, slash),
    model: modelId.slice(slash + 1),
  };
}

export function toChatTelemetryPayload<TOOLS extends ToolSet>(input: {
  sessionId: string | null;
  userId: string | null;
  workflowRunId: string;
  domain?: string;
  modelId: string;
  tools: string[];
  messages: ModelMessage[];
  systemPrompt: string;
  steps: ReadonlyArray<StepResult<TOOLS>>;
}) {
  return {
    sessionId: input.sessionId,
    userId: input.userId,
    workflowRunId: input.workflowRunId,
    domain: input.domain,
    modelId: input.modelId,
    tools: input.tools,
    input: [{ role: "system" as const, content: input.systemPrompt }, ...input.messages],
    steps: input.steps.map((step) => ({
      callId: step.callId,
      stepNumber: step.stepNumber,
      finishReason: step.finishReason,
      text: step.text,
      modelId: step.response.modelId || input.modelId,
      generationId: readGatewayGenerationId(step.providerMetadata),
      inputTokens: step.usage.inputTokens,
      outputTokens: step.usage.outputTokens,
      reasoningTokens: step.usage.outputTokenDetails?.reasoningTokens,
      cacheReadTokens: step.usage.inputTokenDetails?.cacheReadTokens,
      cacheWriteTokens: step.usage.inputTokenDetails?.cacheWriteTokens,
      latencySeconds: step.performance.responseTimeMs / 1000,
      timeToFirstTokenSeconds:
        step.performance.timeToFirstOutputMs != null
          ? step.performance.timeToFirstOutputMs / 1000
          : undefined,
      toolCalls: step.toolCalls.map((call) => ({
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        input: call.input,
      })),
      toolResults: step.toolResults.map((result) => {
        const executionMs = step.performance.toolExecutionMs[result.toolCallId];
        return {
          toolCallId: result.toolCallId,
          toolName: result.toolName,
          output: result.output,
          latencySeconds: executionMs != null ? executionMs / 1000 : undefined,
          isError: isToolError(result.output),
        };
      }),
    })),
  };
}

export type ChatTelemetryPayload = ReturnType<typeof toChatTelemetryPayload>;

function sessionProperties(payload: ChatTelemetryPayload): Record<string, unknown> {
  return {
    $ai_trace_id: payload.workflowRunId,
    ...(payload.sessionId ? { $ai_session_id: payload.sessionId } : {}),
    ...(payload.domain ? { domain: payload.domain } : {}),
  };
}

function generationOutput(step: ChatTelemetryPayload["steps"][number]): Record<string, unknown> {
  const content: Record<string, unknown> = {
    role: "assistant",
    content: step.text || null,
  };

  if (step.toolCalls.length > 0) {
    content.tool_calls = step.toolCalls.map((call) => ({
      id: call.toolCallId,
      type: "function",
      function: {
        name: call.toolName,
        arguments: call.input,
      },
    }));
  }

  return content;
}

function overlayGeneration(
  step: ChatTelemetryPayload["steps"][number],
  payload: ChatTelemetryPayload,
  info: GatewayGenerationSnapshot | undefined,
) {
  const parsed = parseGatewayModelId(info?.model || step.modelId || payload.modelId);

  return {
    provider: info?.providerName ? normalizeProvider(info.providerName) : parsed.provider,
    model: parsed.model,
    inputTokens: info?.promptTokens ?? step.inputTokens,
    outputTokens: info?.completionTokens ?? step.outputTokens,
    reasoningTokens: info?.reasoningTokens ?? step.reasoningTokens,
    cacheReadTokens: info?.cachedTokens ?? step.cacheReadTokens,
    cacheWriteTokens: info?.cacheCreationTokens ?? step.cacheWriteTokens,
    totalCostUsd: info?.totalCost,
    webSearchCount: info?.billableWebSearchCalls,
  };
}

export function buildAiObservabilityEvents(
  payload: ChatTelemetryPayload,
  generations: ReadonlyMap<string, GatewayGenerationSnapshot> = new Map(),
) {
  const shared = sessionProperties(payload);
  const events = [];

  for (const step of payload.steps) {
    const info = step.generationId ? generations.get(step.generationId) : undefined;
    const generation = overlayGeneration(step, payload, info);

    events.push({
      event: "$ai_generation" as const,
      properties: {
        ...shared,
        $ai_span_id: step.callId,
        $ai_span_name: "chatWorkflow",
        $ai_model: generation.model,
        $ai_provider: generation.provider,
        $ai_input: payload.input,
        $ai_output_choices: [generationOutput(step)],
        $ai_tools: payload.tools,
        $ai_input_tokens: generation.inputTokens,
        $ai_output_tokens: generation.outputTokens,
        ...(generation.reasoningTokens != null
          ? { $ai_reasoning_tokens: generation.reasoningTokens }
          : {}),
        ...(generation.cacheReadTokens != null
          ? { $ai_cache_read_input_tokens: generation.cacheReadTokens }
          : {}),
        ...(generation.cacheWriteTokens != null
          ? { $ai_cache_creation_input_tokens: generation.cacheWriteTokens }
          : {}),
        ...(generation.totalCostUsd != null ? { $ai_total_cost_usd: generation.totalCostUsd } : {}),
        ...(generation.webSearchCount ? { $ai_web_search_count: generation.webSearchCount } : {}),
        $ai_latency: step.latencySeconds,
        ...(step.timeToFirstTokenSeconds != null
          ? { $ai_time_to_first_token: step.timeToFirstTokenSeconds }
          : {}),
        $ai_stop_reason: step.finishReason,
        $ai_stream: true,
      },
    });

    for (const result of step.toolResults) {
      events.push({
        event: "$ai_span" as const,
        properties: {
          ...shared,
          $ai_span_id: result.toolCallId,
          $ai_span_name: result.toolName,
          $ai_parent_id: step.callId,
          ...(result.latencySeconds != null ? { $ai_latency: result.latencySeconds } : {}),
          ...(result.isError ? { $ai_is_error: true } : {}),
        },
      });
    }
  }

  return events;
}

export async function lookupGatewayGenerations(
  ids: ReadonlyArray<string | undefined>,
): Promise<Map<string, GatewayGenerationSnapshot>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) {
    return new Map();
  }

  const { gateway } = await import("@ai-sdk/gateway");
  const entries = await Promise.all(
    unique.map(async (id) => {
      try {
        const info = await gateway.getGenerationInfo({ id });
        return [id, info] as const;
      } catch {
        return [id, undefined] as const;
      }
    }),
  );

  return new Map(
    entries.filter((entry): entry is readonly [string, GatewayGenerationInfo] => entry[1] != null),
  );
}

export async function captureChatTelemetry(payload: ChatTelemetryPayload): Promise<void> {
  try {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) {
      return;
    }

    const generations = await lookupGatewayGenerations(
      payload.steps.map((step) => step.generationId),
    );

    const { PostHog } = await import("posthog-node");
    const posthog = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });

    try {
      const distinctId = payload.userId ?? "anonymous";
      const events = buildAiObservabilityEvents(payload, generations);
      await Promise.all(
        events.map((event) =>
          posthog.captureImmediate({
            event: event.event,
            distinctId,
            properties: event.properties,
          }),
        ),
      );
      await posthog.flush();
    } finally {
      await posthog.shutdown();
    }
  } catch {
    // Analytics must never fail the chat
  }
}

export async function captureChatTelemetryStep(payload: ChatTelemetryPayload): Promise<void> {
  "use step";

  await captureChatTelemetry(payload);
}
