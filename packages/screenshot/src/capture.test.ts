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

function runnerFailure(errorCode: string) {
  return JSON.stringify({
    success: false,
    width: null,
    height: null,
    finalUrl: null,
    adblock: "enabled",
    browserVersion: "Chrome/150.0.7871.100",
    durationMs: 80,
    errorCode,
  });
}

function createSandboxMock(options?: {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
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
        adblock: "enabled",
        browserVersion: "Chrome/150.0.7871.100",
        durationMs: 120,
        errorCode: null,
      }),
  );
  const stderr = vi.fn<() => Promise<string>>().mockResolvedValue(options?.stderr ?? "");
  const runCommand = vi
    .fn<() => Promise<{ exitCode: number; stdout: typeof stdout; stderr: typeof stderr }>>()
    .mockResolvedValue({
      exitCode: options?.exitCode ?? 0,
      stdout,
      stderr,
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
      stdout: runnerFailure("invalid_url"),
      stopError: new Error("stop failed"),
    });
    mocks.createSandbox.mockResolvedValue(sandbox);

    const error = await captureScreenshotBase64("https://example.com").catch((caught) => caught);
    expect(error).toBeInstanceOf(ScreenshotError);
    expect(error).toMatchObject({ code: "invalid_url" });
    expect(classifyScreenshotError(error)).toBe("permanent_target");
    expect(sandbox.stop).toHaveBeenCalledOnce();
  });

  // The pre-flight resolve already succeeded, so the same lookup failing inside
  // the sandbox is transient and must not cache the domain as missing.
  it.each(["dns_error", "tls_error"])(
    "retries a runner-reported %s instead of caching it as a bad target",
    async (runnerCode) => {
      const sandbox = createSandboxMock({ exitCode: 1, stdout: runnerFailure(runnerCode) });
      mocks.createSandbox.mockResolvedValue(sandbox);

      const error = await captureScreenshotBase64("https://example.com").catch((caught) => caught);
      expect(error).toMatchObject({
        code: "upstream_temporary",
        context: expect.objectContaining({ runnerErrorCode: runnerCode }),
      });
      expect(classifyScreenshotError(error)).toBe("retryable_infrastructure");
    },
  );

  it("stops retrying a capture that exceeds the size limit", async () => {
    const sandbox = createSandboxMock({ exitCode: 1, stdout: runnerFailure("output_too_large") });
    mocks.createSandbox.mockResolvedValue(sandbox);

    const error = await captureScreenshotBase64("https://example.com").catch((caught) => caught);
    expect(classifyScreenshotError(error)).toBe("permanent_target");
  });

  it("keeps the captured image when stopping the sandbox fails", async () => {
    const sandbox = createSandboxMock({ stopError: new Error("stop failed") });
    mocks.createSandbox.mockResolvedValue(sandbox);

    await expect(captureScreenshotBase64("https://example.com")).resolves.toMatchObject({
      imageBase64: Buffer.from("webp").toString("base64"),
      cleanupSucceeded: false,
    });
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ sandboxId: "sbx_test" }),
      "failed to stop screenshot sandbox",
    );
  });

  it("attaches truncated runner stderr to the failure context", async () => {
    const sandbox = createSandboxMock({
      exitCode: 1,
      stdout: runnerFailure("capture_failed"),
      stderr: "  chromium exploded  ",
    });
    mocks.createSandbox.mockResolvedValue(sandbox);

    const error = await captureScreenshotBase64("https://example.com").catch((caught) => caught);
    expect(error).toMatchObject({
      context: expect.objectContaining({ stderr: "chromium exploded" }),
    });
  });

  // resolvePublicHost reports its own timeout and the resolver's temporary
  // failures under the same code as a genuine NXDOMAIN.
  it.each([
    ["DNS lookup timed out after 8000ms"],
    ["getaddrinfo EAI_AGAIN example.com"],
    ["queryA ESERVFAIL example.com"],
  ])("retries a transient DNS failure (%s)", async (message) => {
    const { SafeFetchError } = await import("@domainstack/safe-fetch");
    mocks.resolvePublicHost.mockRejectedValue(new SafeFetchError("dns_error", message));

    const error = await captureScreenshotBase64("https://example.com").catch((caught) => caught);
    expect(error).toMatchObject({ code: "upstream_temporary" });
    expect(classifyScreenshotError(error)).toBe("retryable_infrastructure");
  });

  it.each([["getaddrinfo ENOTFOUND example.com"], ["DNS lookup returned no records"]])(
    "caches a definitive DNS failure (%s)",
    async (message) => {
      const { SafeFetchError } = await import("@domainstack/safe-fetch");
      mocks.resolvePublicHost.mockRejectedValue(new SafeFetchError("dns_error", message));

      const error = await captureScreenshotBase64("https://example.com").catch((caught) => caught);
      expect(error).toMatchObject({ code: "dns_error" });
      expect(classifyScreenshotError(error)).toBe("permanent_target");
    },
  );

  it("keeps an internal resolver fault retryable", async () => {
    mocks.resolvePublicHost.mockRejectedValue(new Error("resolver exploded"));

    const error = await captureScreenshotBase64("https://example.com").catch((caught) => caught);
    expect(error).toMatchObject({ code: "upstream_temporary" });
    expect(classifyScreenshotError(error)).toBe("retryable_infrastructure");
    expect(mocks.createSandbox).not.toHaveBeenCalled();
  });

  it("classifies Sandbox creation failures as retryable infrastructure errors", async () => {
    mocks.createSandbox.mockRejectedValue(new Error("control plane unavailable"));

    const error = await captureScreenshotBase64("https://example.com").catch((caught) => caught);
    expect(error).toMatchObject({ code: "sandbox_control_plane" });
    expect(classifyScreenshotError(error)).toBe("retryable_infrastructure");
  });

  it("requires an immutable image reference", async () => {
    process.env.SCREENSHOT_SANDBOX_IMAGE = "domainstack-screenshot:latest";

    const error = await captureScreenshotBase64("https://example.com").catch((caught) => caught);
    expect(error).toMatchObject({ code: "configuration_error" });
    // A broken deployment is neither retried nor cached against the domain.
    expect(classifyScreenshotError(error)).toBe("permanent_configuration");
    expect(mocks.createSandbox).not.toHaveBeenCalled();
  });
});
