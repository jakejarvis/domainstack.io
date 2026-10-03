import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";

import { renderHook } from "@/mocks/react";

import { useLocalChat, type UseLocalChatOptions } from "./use-local-chat";

vi.mock("@domainstack/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@domainstack/constants")>()),
  CHAT_STALL_TIMEOUT_MS: 200,
  CHAT_RUN_TIMEOUT_MS: 2_000,
}));

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

function modelFromChunks(chunks: unknown[]) {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({ chunks }) as never,
    }),
  });
}

/**
 * Emits `stream-start`, then goes silent. Like a real provider it errors with
 * an AbortError once the SDK aborts the call (timeout or stop).
 */
function stallingModel() {
  return new MockLanguageModelV4({
    doStream: async ({ abortSignal }) => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] });
          abortSignal?.addEventListener("abort", () => {
            controller.error(new DOMException("aborted", "AbortError"));
          });
        },
      }) as never,
    }),
  });
}

async function renderLocalChat(model: MockLanguageModelV4) {
  const onError = vi.fn<(error: Error) => void>();
  const options: UseLocalChatOptions = {
    model: model as never,
    tools: {},
    systemPrompt: "test",
    onError,
  };
  const { result } = await renderHook(() => useLocalChat(options));
  return { onError, result };
}

describe("useLocalChat", () => {
  it("reports a model error and shows no empty reply", async () => {
    const { result, onError } = await renderLocalChat(
      modelFromChunks([
        { type: "stream-start", warnings: [] },
        { type: "error", error: new Error("model exploded") },
      ]),
    );

    result.current.sendMessage({ text: "hi" });

    await vi.waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.message).toContain("model exploded");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]?.role).toBe("user");
  });

  it("reports a stall timeout", async () => {
    const { result, onError } = await renderLocalChat(stallingModel());

    result.current.sendMessage({ text: "hi" });

    await vi.waitFor(() => expect(result.current.status).toBe("error"), { timeout: 3_000 });
    expect(result.current.error?.message).toBe("Local chat timed out");
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("stays quiet when the user stops", async () => {
    const { result, onError } = await renderLocalChat(stallingModel());

    result.current.sendMessage({ text: "hi" });
    await vi.waitFor(() => expect(result.current.status).toBe("streaming"));

    result.current.stop();
    // Longer than the 200ms stall timeout, so a late error would have surfaced.
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(result.current.status).toBe("ready");
    expect(result.current.error).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it("completes normally on a text reply", async () => {
    const { result, onError } = await renderLocalChat(
      modelFromChunks([
        { type: "stream-start", warnings: [] },
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", delta: "hello" },
        { type: "text-end", id: "t1" },
        { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
      ]),
    );

    result.current.sendMessage({ text: "hi" });

    await vi.waitFor(() => {
      expect(result.current.status).toBe("ready");
      expect(result.current.messages).toHaveLength(2);
    });
    const reply = result.current.messages[1];
    expect(reply?.role).toBe("assistant");
    expect(reply?.parts).toContainEqual(expect.objectContaining({ type: "text", text: "hello" }));
    expect(result.current.error).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });
});
