/* @vitest-environment node */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type StreamOptions = {
  onError?: (event: { error: unknown }) => Promise<void> | void;
  onAbort?: (event: { steps: unknown[] }) => Promise<void> | void;
};

const mocks = vi.hoisted(() => ({
  chunks: [] as unknown[],
  stream: vi.fn<(options: StreamOptions) => Promise<{ steps: unknown[]; messages: unknown[] }>>(),
}));

vi.mock("workflow", () => ({
  getWritable: () =>
    new WritableStream({
      write(chunk) {
        mocks.chunks.push(chunk);
      },
    }),
  getWorkflowMetadata: () => ({ workflowRunId: "run-1" }),
}));

vi.mock("@ai-sdk/workflow", () => ({
  WorkflowAgent: class {
    stream(options: StreamOptions & { writable: WritableStream }) {
      return mocks.stream(options);
    }
  },
}));

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  convertToModelMessages: async () => [],
}));

vi.mock("./telemetry", () => ({
  captureChatTelemetryStep: async () => undefined,
  toChatTelemetryPayload: () => ({}),
}));

vi.mock("./tools", () => ({
  createDomainToolset: () => ({}),
  createDomainToolsContext: () => ({}),
}));

// Load the module (and its SDK imports) under the hook timeout instead of
// inside the first test's budget.
beforeAll(async () => {
  await import("./workflow");
});

async function run() {
  const { chatWorkflow } = await import("./workflow");
  return chatWorkflow({
    messages: [],
    ip: null,
    userId: null,
    sessionId: null,
    systemPrompt: "prompt",
    model: "test/model",
    promptName: "chat",
    promptVersion: 1,
  });
}

function errorChunks() {
  return mocks.chunks.filter((chunk) => (chunk as { type?: string }).type === "error") as {
    type: "error";
    error: unknown;
  }[];
}

describe("chatWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chunks.length = 0;
  });

  it("writes a fixed error chunk when the model call fails, without provider details", async () => {
    mocks.stream.mockImplementation(async (options) => {
      await options.onError?.({ error: new Error("gateway 503 secret-detail") });
      return { steps: [], messages: [] };
    });

    await run();

    const errors = errorChunks();
    expect(errors).toHaveLength(1);
    expect(errors[0].error).toBe("Chat model request failed");
    expect(JSON.stringify(mocks.chunks)).not.toContain("secret-detail");
  });

  it("writes a timeout error chunk when the run is aborted", async () => {
    mocks.stream.mockImplementation(async (options) => {
      await options.onAbort?.({ steps: [] });
      return { steps: [], messages: [] };
    });

    await run();

    const errors = errorChunks();
    expect(errors).toHaveLength(1);
    expect(errors[0].error).toBe("Chat run timed out");
  });

  it("writes no error chunk when the turn completes normally", async () => {
    mocks.stream.mockResolvedValue({ steps: [], messages: [] });

    await run();

    expect(errorChunks()).toHaveLength(0);
  });
});
