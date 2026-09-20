import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

import { DOMAIN_TOOL_DEFS } from "@/lib/chat/domain-tools";
import type { WebMcpTool } from "@/lib/webmcp/model-context";
import { render } from "@/mocks/react";

import { WebMcpTools } from "./webmcp-tools";

const query = vi.hoisted(() => vi.fn<(input: { domain: string }) => Promise<unknown>>());

vi.mock("@/lib/trpc/client", () => ({
  useTRPCClient: () => ({
    domain: new Proxy({}, { get: () => ({ query }) }),
  }),
}));

type RegisterTool = (tool: WebMcpTool, options?: { signal?: AbortSignal }) => Promise<undefined>;
type ModelContextStub = { registerTool: Mock<RegisterTool> };

function installModelContext(target: Document | Navigator): ModelContextStub {
  const stub: ModelContextStub = {
    registerTool: vi.fn<RegisterTool>(() => Promise.resolve(undefined)),
  };
  Object.defineProperty(target, "modelContext", { value: stub, configurable: true });
  return stub;
}

afterEach(() => {
  Reflect.deleteProperty(document, "modelContext");
  Reflect.deleteProperty(navigator, "modelContext");
  query.mockReset();
});

describe("WebMcpTools", () => {
  it("does nothing when WebMCP is unavailable", async () => {
    await expect(render(<WebMcpTools />)).resolves.toBeDefined();
  });

  it("registers a read-only tool per lookup section on document.modelContext", async () => {
    const modelContext = installModelContext(document);
    await render(<WebMcpTools />);
    await vi.waitFor(() => expect(modelContext.registerTool).toHaveBeenCalled());

    const tools = modelContext.registerTool.mock.calls.map(([tool]) => tool);
    expect(tools.map((tool) => tool.name)).toEqual(DOMAIN_TOOL_DEFS.map((def) => def.name));
    for (const tool of tools) {
      expect(tool.annotations).toEqual({ readOnlyHint: true, untrustedContentHint: true });
      expect(tool.inputSchema).toMatchObject({ required: ["domain"] });
    }
  });

  it("falls back to navigator.modelContext", async () => {
    const modelContext = installModelContext(navigator);
    await render(<WebMcpTools />);
    await vi.waitFor(() =>
      expect(modelContext.registerTool).toHaveBeenCalledTimes(DOMAIN_TOOL_DEFS.length),
    );
  });

  it("returns lookup data, or an error object when the lookup fails", async () => {
    const modelContext = installModelContext(document);
    await render(<WebMcpTools />);
    await vi.waitFor(() => expect(modelContext.registerTool).toHaveBeenCalled());
    const tool = modelContext.registerTool.mock.calls[0][0];

    query.mockResolvedValueOnce({ success: true, data: { registrar: "Example" } });
    await expect(tool.execute({ domain: " example.com " }, {})).resolves.toEqual({
      registrar: "Example",
    });
    expect(query).toHaveBeenCalledWith({ domain: "example.com" });

    query.mockRejectedValueOnce(new Error("boom"));
    await expect(tool.execute({ domain: "example.com" }, {})).resolves.toHaveProperty("error");
  });
});
