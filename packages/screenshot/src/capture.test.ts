import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSandbox: vi.fn<(options: Record<string, unknown>) => Promise<unknown>>(),
  loggerInfo: vi.fn<(bindings: Record<string, unknown>, message: string) => void>(),
  loggerWarn: vi.fn<(bindings: Record<string, unknown>, message: string) => void>(),
  resolvePublicHost: vi.fn<(hostname: string) => Promise<unknown>>(),
}));

vi.mock("@domainstack/logger", () => ({
  createLogger: () => ({ info: mocks.loggerInfo, warn: mocks.loggerWarn }),
}));

vi.mock("@vercel/sandbox", () => ({
  Sandbox: { create: mocks.createSandbox },
}));

vi.mock("@domainstack/safe-fetch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@domainstack/safe-fetch")>();
  return { ...actual, resolvePublicHost: mocks.resolvePublicHost };
});

import { captureScreenshotBase64, classifyScreenshotError, ScreenshotError } from "./index";

function createSandboxMock(options?: {
  exitCode?: number;
  stdout?: string;
  buffer?: Buffer | null;
  stopError?: Error;
}) {
  const stop = vi.fn<() => Promise<void>>();
  if (options?.stopError) stop.mockRejectedValue(options.stopError);
  else stop.mockResolvedValue(undefined);
  const stdout = vi.fn<() => Promise<string>>().mockResolvedValue(
    options?.stdout ??
      JSON.stringify({
        success: true,
        width: 1200,
        height: 630,
        finalUrl: "https://example.com/",
        durationMs: 120,
        errorCode: null,
      }),
  );
  const runCommand = vi
    .fn<() => Promise<{ exitCode: number; stdout: typeof stdout }>>()
    .mockResolvedValue({
      exitCode: options?.exitCode ?? 0,
      stdout,
    });
  const readFileToBuffer = vi
    .fn<() => Promise<Buffer | null>>()
    .mockResolvedValue(options?.buffer ?? Buffer.from("webp"));
  return { name: "sbx_test", runCommand, readFileToBuffer, stop };
}

describe("captureScreenshotBase64", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SCREENSHOT_SANDBOX_IMAGE = `domainstack-screenshot@sha256:${"a".repeat(64)}`;
    delete process.env.SCREENSHOT_SANDBOX_REGION;
    mocks.resolvePublicHost.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });

  it("rejects non-HTTPS targets before DNS or sandbox creation", async () => {
    await expect(captureScreenshotBase64("http://example.com")).rejects.toMatchObject({
      code: "invalid_url",
    });
    expect(mocks.resolvePublicHost).not.toHaveBeenCalled();
    expect(mocks.createSandbox).not.toHaveBeenCalled();
  });

  it("creates an ephemeral restricted sandbox and returns the existing base64 contract", async () => {
    const sandbox = createSandboxMock();
    mocks.createSandbox.mockResolvedValue(sandbox);

    await expect(captureScreenshotBase64("https://example.com")).resolves.toMatchObject({
      imageBase64: Buffer.from("webp").toString("base64"),
      width: 1200,
      height: 630,
      sandboxId: "sbx_test",
      cleanupSucceeded: true,
    });

    expect(mocks.createSandbox).toHaveBeenCalledWith(
      expect.objectContaining({
        image: `domainstack-screenshot@sha256:${"a".repeat(64)}`,
        resources: { vcpus: 2 },
        persistent: false,
        timeout: 45_000,
        ports: [],
        networkPolicy: expect.objectContaining({
          allow: { "*": [] },
          subnets: { deny: expect.arrayContaining(["127.0.0.0/8", "169.254.0.0/16", "::1/128"]) },
        }),
      }),
    );
    expect(sandbox.runCommand).toHaveBeenCalledWith(
      "node",
      expect.arrayContaining([
        "--url",
        "https://example.com/",
        "--width",
        "1200",
        "--height",
        "630",
        "--format",
        "webp",
      ]),
      { timeoutMs: 30_000 },
    );
    expect(sandbox.stop).toHaveBeenCalledOnce();
  });

  it("preserves a permanent runner failure when sandbox cleanup also fails", async () => {
    const sandbox = createSandboxMock({
      exitCode: 1,
      stdout: JSON.stringify({
        success: false,
        width: null,
        height: null,
        finalUrl: null,
        durationMs: 80,
        errorCode: "tls_error",
      }),
      stopError: new Error("stop failed"),
    });
    mocks.createSandbox.mockResolvedValue(sandbox);

    const error = await captureScreenshotBase64("https://example.com").catch((caught) => caught);
    expect(error).toBeInstanceOf(ScreenshotError);
    expect(error).toMatchObject({ code: "tls_error" });
    expect(classifyScreenshotError(error)).toBe("permanent_target");
    expect(sandbox.stop).toHaveBeenCalledOnce();
  });

  it("classifies Sandbox creation failures as retryable infrastructure errors", async () => {
    mocks.createSandbox.mockRejectedValue(new Error("control plane unavailable"));

    const error = await captureScreenshotBase64("https://example.com").catch((caught) => caught);
    expect(error).toMatchObject({ code: "sandbox_control_plane" });
    expect(classifyScreenshotError(error)).toBe("retryable_infrastructure");
  });

  it("requires an immutable image reference", async () => {
    process.env.SCREENSHOT_SANDBOX_IMAGE = "domainstack-screenshot:latest";

    await expect(captureScreenshotBase64("https://example.com")).rejects.toMatchObject({
      code: "configuration_error",
    });
    expect(mocks.createSandbox).not.toHaveBeenCalled();
  });
});
