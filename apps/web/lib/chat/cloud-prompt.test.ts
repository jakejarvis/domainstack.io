/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructed: vi.fn<() => void>(),
  get: vi.fn<(name: string) => Promise<Record<string, unknown>>>(),
}));

vi.mock("@posthog/ai", () => ({
  Prompts: class MockPrompts {
    constructor() {
      mocks.constructed();
    }
    get = mocks.get;
    compile = (prompt: string) => prompt;
  },
}));

const remotePrompt = {
  source: "api",
  name: "cloud-chat-system-prompt",
  version: 3,
  prompt: "Hi {{domainContext}}",
  config: { model: "provider/model" },
};

async function loadModule() {
  return import("./cloud-prompt");
}

describe("resolveCloudPrompt", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.constructed.mockReset();
    mocks.get.mockReset();
    mocks.get.mockResolvedValue(remotePrompt);
    process.env.POSTHOG_API_KEY = "phx_test";
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
  });

  it("reuses one Prompts client across calls", async () => {
    const { resolveCloudPrompt } = await loadModule();

    const first = await resolveCloudPrompt();
    await resolveCloudPrompt();

    expect(first).toMatchObject({
      model: "provider/model",
      promptName: "cloud-chat-system-prompt",
      promptVersion: 3,
    });
    expect(mocks.constructed).toHaveBeenCalledTimes(1);
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });

  it("accepts a stale_cache result", async () => {
    mocks.get.mockResolvedValue({ ...remotePrompt, source: "stale_cache" });
    const { resolveCloudPrompt } = await loadModule();

    await expect(resolveCloudPrompt()).resolves.toMatchObject({ promptVersion: 3 });
  });

  it("rejects a code_fallback result", async () => {
    mocks.get.mockResolvedValue({ ...remotePrompt, source: "code_fallback" });
    const { resolveCloudPrompt } = await loadModule();

    await expect(resolveCloudPrompt()).rejects.toThrow("could not be fetched");
  });

  it("rejects without constructing Prompts when POSTHOG_API_KEY is missing", async () => {
    delete process.env.POSTHOG_API_KEY;
    const { resolveCloudPrompt } = await loadModule();

    await expect(resolveCloudPrompt()).rejects.toThrow("POSTHOG_API_KEY");
    expect(mocks.constructed).not.toHaveBeenCalled();
  });
});
