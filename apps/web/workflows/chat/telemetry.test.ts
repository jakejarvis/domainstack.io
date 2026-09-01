/* @vitest-environment node */
import type { ModelMessage, StepResult, ToolSet } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildAiObservabilityEvents,
  captureChatTelemetry,
  parseGatewayModelId,
  toChatTelemetryPayload,
  type ChatTelemetryPayload,
  type GatewayGenerationSnapshot,
} from "./telemetry";

const mocks = vi.hoisted(() => ({
  captureImmediate: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
  flush: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
  shutdown: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
  getGenerationInfo:
    vi.fn<(...args: unknown[]) => Promise<GatewayGenerationSnapshot | undefined>>(),
}));

vi.mock("posthog-node", () => ({
  PostHog: class MockPostHog {
    captureImmediate = mocks.captureImmediate;
    flush = mocks.flush;
    shutdown = mocks.shutdown;
  },
}));

vi.mock("@ai-sdk/gateway", () => ({
  gateway: {
    getGenerationInfo: mocks.getGenerationInfo,
  },
}));

function payload(overrides?: Partial<ChatTelemetryPayload>): ChatTelemetryPayload {
  return {
    sessionId: "session-1",
    userId: "user-1",
    workflowRunId: "run-1",
    domain: "example.com",
    modelId: "google/gemini-2.5-flash",
    tools: ["get_registration"],
    input: [{ role: "user", content: "who owns example.com?" }],
    steps: [
      {
        callId: "call-1",
        stepNumber: 0,
        finishReason: "tool-calls",
        text: "",
        modelId: "google/gemini-2.5-flash",
        generationId: "gen_01ABC",
        inputTokens: 120,
        outputTokens: 40,
        reasoningTokens: undefined,
        cacheReadTokens: 10,
        cacheWriteTokens: undefined,
        latencySeconds: 1.5,
        timeToFirstTokenSeconds: 0.25,
        toolCalls: [
          {
            toolCallId: "tool-1",
            toolName: "get_registration",
            input: { domain: "example.com" },
          },
        ],
        toolResults: [
          {
            toolCallId: "tool-1",
            toolName: "get_registration",
            output: { registrar: "Example Registrar" },
            latencySeconds: 0.4,
            isError: false,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function gatewayGeneration(
  overrides?: Partial<GatewayGenerationSnapshot>,
): GatewayGenerationSnapshot {
  return {
    model: "google/gemini-2.5-flash",
    providerName: "vertex",
    totalCost: 0.00042,
    promptTokens: 118,
    completionTokens: 41,
    reasoningTokens: 6,
    cachedTokens: 12,
    cacheCreationTokens: 3,
    billableWebSearchCalls: 0,
    ...overrides,
  };
}

describe("parseGatewayModelId", () => {
  it("splits provider and model from a gateway id", () => {
    expect(parseGatewayModelId("google/gemini-2.5-flash")).toEqual({
      provider: "google",
      model: "gemini-2.5-flash",
    });
  });

  it("does not report gateway as the provider when the id has no slash", () => {
    expect(parseGatewayModelId("gemini-2.5-flash")).toEqual({
      provider: "unknown",
      model: "gemini-2.5-flash",
    });
  });
});

describe("toChatTelemetryPayload", () => {
  it("converts step timings to seconds and flags tool errors", () => {
    const result = toChatTelemetryPayload({
      sessionId: "session-1",
      userId: "user-1",
      workflowRunId: "run-1",
      domain: "example.com",
      modelId: "google/gemini-2.5-flash",
      tools: ["get_registration"],
      systemPrompt: "You are Stacky.",
      messages: [{ role: "user", content: "who owns example.com?" }] as ModelMessage[],
      steps: [
        {
          callId: "call-1",
          stepNumber: 0,
          finishReason: "tool-calls",
          text: "",
          usage: {
            inputTokens: 12,
            outputTokens: 8,
            inputTokenDetails: { cacheReadTokens: 2 },
            outputTokenDetails: { reasoningTokens: 6 },
          },
          performance: {
            responseTimeMs: 1500,
            timeToFirstOutputMs: 250,
            toolExecutionMs: { "tool-1": 400 },
          },
          response: { modelId: "google/gemini-2.5-pro" },
          providerMetadata: { gateway: { generationId: "gen_01ABC" } },
          toolCalls: [
            {
              toolCallId: "tool-1",
              toolName: "get_registration",
              input: { domain: "example.com" },
            },
          ],
          toolResults: [
            {
              toolCallId: "tool-1",
              toolName: "get_registration",
              output: { error: "rate limited" },
            },
          ],
        } as unknown as StepResult<ToolSet>,
      ],
    });

    expect(result.input).toEqual([
      { role: "system", content: "You are Stacky." },
      { role: "user", content: "who owns example.com?" },
    ]);
    expect(result.steps[0]).toMatchObject({
      latencySeconds: 1.5,
      timeToFirstTokenSeconds: 0.25,
      cacheReadTokens: 2,
      reasoningTokens: 6,
      modelId: "google/gemini-2.5-pro",
      generationId: "gen_01ABC",
      toolResults: [{ toolCallId: "tool-1", latencySeconds: 0.4, isError: true }],
    });
  });
});

describe("buildAiObservabilityEvents", () => {
  it("emits a generation and a tool span that share the turn's trace and session", () => {
    const events = buildAiObservabilityEvents(payload());

    expect(events).toHaveLength(2);

    expect(events[0]).toMatchObject({
      event: "$ai_generation",
      properties: {
        $ai_trace_id: "run-1",
        $ai_session_id: "session-1",
        $ai_span_id: "call-1",
        $ai_model: "gemini-2.5-flash",
        $ai_provider: "google",
        $ai_input_tokens: 120,
        $ai_output_tokens: 40,
        $ai_cache_read_input_tokens: 10,
        $ai_latency: 1.5,
        $ai_time_to_first_token: 0.25,
        $ai_stop_reason: "tool-calls",
        $ai_stream: true,
        $ai_tools: ["get_registration"],
        domain: "example.com",
      },
    });

    expect(events[1]).toMatchObject({
      event: "$ai_span",
      properties: {
        $ai_trace_id: "run-1",
        $ai_session_id: "session-1",
        $ai_span_id: "tool-1",
        $ai_span_name: "get_registration",
        $ai_parent_id: "call-1",
        $ai_latency: 0.4,
      },
    });
  });

  it("overlays billed cost and the provider that served the call", () => {
    const events = buildAiObservabilityEvents(
      payload(),
      new Map([["gen_01ABC", gatewayGeneration()]]),
    );

    expect(events[0]).toMatchObject({
      event: "$ai_generation",
      properties: {
        $ai_provider: "vertex",
        $ai_model: "gemini-2.5-flash",
        $ai_input_tokens: 118,
        $ai_output_tokens: 41,
        $ai_reasoning_tokens: 6,
        $ai_cache_read_input_tokens: 12,
        $ai_cache_creation_input_tokens: 3,
        $ai_total_cost_usd: 0.00042,
      },
    });
    expect(events[0]?.properties).not.toHaveProperty("$ai_web_search_count");
  });

  it("omits session id and cache tokens when they are absent", () => {
    const events = buildAiObservabilityEvents(
      payload({
        sessionId: null,
        domain: undefined,
        steps: [
          {
            callId: "call-1",
            stepNumber: 0,
            finishReason: "stop",
            text: "Hello",
            modelId: "google/gemini-2.5-flash",
            generationId: undefined,
            inputTokens: 8,
            outputTokens: 4,
            reasoningTokens: undefined,
            cacheReadTokens: undefined,
            cacheWriteTokens: undefined,
            latencySeconds: 0.8,
            timeToFirstTokenSeconds: undefined,
            toolCalls: [],
            toolResults: [],
          },
        ],
      }),
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.properties).not.toHaveProperty("$ai_session_id");
    expect(events[0]?.properties).not.toHaveProperty("$ai_cache_read_input_tokens");
    expect(events[0]?.properties).not.toHaveProperty("$ai_total_cost_usd");
    expect(events[0]?.properties).not.toHaveProperty("domain");
    expect(events[0]).toMatchObject({
      event: "$ai_generation",
      properties: {
        $ai_output_choices: [{ role: "assistant", content: "Hello" }],
      },
    });
  });
});

describe("captureChatTelemetry", () => {
  const originalKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  beforeEach(() => {
    mocks.captureImmediate.mockClear();
    mocks.flush.mockClear();
    mocks.shutdown.mockClear();
    mocks.getGenerationInfo.mockReset();
    mocks.getGenerationInfo.mockRejectedValue(new Error("generation not ready"));
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    } else {
      process.env.NEXT_PUBLIC_POSTHOG_KEY = originalKey;
    }
  });

  it("no-ops when the PostHog key is missing", async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

    await captureChatTelemetry(payload());

    expect(mocks.getGenerationInfo).not.toHaveBeenCalled();
    expect(mocks.captureImmediate).not.toHaveBeenCalled();
    expect(mocks.flush).not.toHaveBeenCalled();
  });

  it("captures events and flushes even if generation lookup fails", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";

    await captureChatTelemetry(payload());

    expect(mocks.getGenerationInfo).toHaveBeenCalledWith({ id: "gen_01ABC" });
    expect(mocks.captureImmediate).toHaveBeenCalledTimes(2);
    expect(mocks.captureImmediate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        event: "$ai_generation",
        distinctId: "user-1",
        properties: expect.not.objectContaining({ $ai_total_cost_usd: expect.anything() }),
      }),
    );
    expect(mocks.captureImmediate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        event: "$ai_span",
        distinctId: "user-1",
      }),
    );
    expect(mocks.flush).toHaveBeenCalledOnce();
    expect(mocks.shutdown).toHaveBeenCalledOnce();
  });

  it("looks up billed generation info before capturing", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
    mocks.getGenerationInfo.mockResolvedValue(gatewayGeneration());

    await captureChatTelemetry(payload());

    expect(mocks.captureImmediate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        event: "$ai_generation",
        properties: expect.objectContaining({
          $ai_provider: "vertex",
          $ai_total_cost_usd: 0.00042,
        }),
      }),
    );
  });

  it("uses anonymous when no user id is present", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";

    await captureChatTelemetry(payload({ userId: null }));

    expect(mocks.captureImmediate).toHaveBeenCalledWith(
      expect.objectContaining({ distinctId: "anonymous" }),
    );
  });
});
