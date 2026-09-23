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

import { captureScreenshot, classifyScreenshotError, ScreenshotError } from "./index";

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
  // `??` would treat an explicit `buffer: null` the same as "not provided",
  // so presence is checked instead — that's exactly the empty_output case.
  const readFileToBuffer = vi
    .fn<() => Promise<Buffer | null>>()
    .mockResolvedValue(options && "buffer" in options ? options.buffer! : Buffer.from("webp"));
  return { name: "sbx_test", runCommand, readFileToBuffer, stop };
}

describe("captureScreenshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SCREENSHOT_SANDBOX_IMAGE = `domainstack-screenshot@sha256:${"a".repeat(64)}`;
    delete process.env.SCREENSHOT_SANDBOX_REGION;
    mocks.resolvePublicHost.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });

  it("rejects non-HTTPS targets before DNS or sandbox creation", async () => {
    await expect(captureScreenshot("http://example.com")).rejects.toMatchObject({
      code: "invalid_url",
    });
    expect(mocks.resolvePublicHost).not.toHaveBeenCalled();
    expect(mocks.createSandbox).not.toHaveBeenCalled();
  });

  it("creates an ephemeral restricted sandbox and returns the existing base64 contract", async () => {
    const sandbox = createSandboxMock();
    mocks.createSandbox.mockResolvedValue(sandbox);

    await expect(captureScreenshot("https://example.com")).resolves.toMatchObject({
      buffer: Buffer.from("webp"),
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

    const error = await captureScreenshot("https://example.com").catch((caught) => caught);
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

      const error = await captureScreenshot("https://example.com").catch((caught) => caught);
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

    const error = await captureScreenshot("https://example.com").catch((caught) => caught);
    expect(classifyScreenshotError(error)).toBe("permanent_target");
  });

  it("keeps the captured image when stopping the sandbox fails", async () => {
    const sandbox = createSandboxMock({ stopError: new Error("stop failed") });
    mocks.createSandbox.mockResolvedValue(sandbox);

    await expect(captureScreenshot("https://example.com")).resolves.toMatchObject({
      buffer: Buffer.from("webp"),
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

    const error = await captureScreenshot("https://example.com").catch((caught) => caught);
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
    // The hostname is interpolated into the message, so it must not be able to
    // pass itself off as the resolver's status.
    ["getaddrinfo EAI_AGAIN thenotfound.com"],
    ["getaddrinfo EAI_AGAIN the-nxdomain.io"],
  ])("retries a transient DNS failure (%s)", async (message) => {
    const { SafeFetchError } = await import("@domainstack/safe-fetch");
    mocks.resolvePublicHost.mockRejectedValue(new SafeFetchError("dns_error", message));

    const error = await captureScreenshot("https://example.com").catch((caught) => caught);
    expect(error).toMatchObject({ code: "upstream_temporary" });
    expect(classifyScreenshotError(error)).toBe("retryable_infrastructure");
  });

  it.each([
    ["getaddrinfo ENOTFOUND example.com"],
    ["getaddrinfo ENODATA example.com"],
    ["getaddrinfo ENOTFOUND thenotfound.com"],
    ["DNS lookup returned no records"],
  ])("caches a definitive DNS failure (%s)", async (message) => {
    const { SafeFetchError } = await import("@domainstack/safe-fetch");
    mocks.resolvePublicHost.mockRejectedValue(new SafeFetchError("dns_error", message));

    const error = await captureScreenshot("https://example.com").catch((caught) => caught);
    expect(error).toMatchObject({ code: "dns_error" });
    expect(classifyScreenshotError(error)).toBe("permanent_target");
  });

  it("keeps an internal resolver fault retryable", async () => {
    mocks.resolvePublicHost.mockRejectedValue(new Error("resolver exploded"));

    const error = await captureScreenshot("https://example.com").catch((caught) => caught);
    expect(error).toMatchObject({ code: "upstream_temporary" });
    expect(classifyScreenshotError(error)).toBe("retryable_infrastructure");
    expect(mocks.createSandbox).not.toHaveBeenCalled();
  });

  it("classifies Sandbox creation failures as retryable infrastructure errors", async () => {
    mocks.createSandbox.mockRejectedValue(new Error("control plane unavailable"));

    const error = await captureScreenshot("https://example.com").catch((caught) => caught);
    expect(error).toMatchObject({ code: "sandbox_control_plane" });
    expect(classifyScreenshotError(error)).toBe("retryable_infrastructure");
  });

  it("requires an immutable image reference", async () => {
    process.env.SCREENSHOT_SANDBOX_IMAGE = "domainstack-screenshot:latest";

    const error = await captureScreenshot("https://example.com").catch((caught) => caught);
    expect(error).toMatchObject({ code: "configuration_error" });
    // A broken deployment is neither retried nor cached against the domain.
    expect(classifyScreenshotError(error)).toBe("permanent_configuration");
    expect(mocks.createSandbox).not.toHaveBeenCalled();
  });

  it("checks the sandbox image before DNS, so an unset image never gets masked by a bad target", async () => {
    delete process.env.SCREENSHOT_SANDBOX_IMAGE;

    const error = await captureScreenshot("https://example.com").catch((caught) => caught);
    expect(error).toMatchObject({ code: "configuration_error" });
    expect(classifyScreenshotError(error)).toBe("permanent_configuration");
    expect(mocks.resolvePublicHost).not.toHaveBeenCalled();
    expect(mocks.createSandbox).not.toHaveBeenCalled();
  });

  it("surfaces a broken deployment instead of caching a domain that also fails DNS", async () => {
    delete process.env.SCREENSHOT_SANDBOX_IMAGE;
    const { SafeFetchError } = await import("@domainstack/safe-fetch");
    mocks.resolvePublicHost.mockRejectedValue(
      new SafeFetchError("dns_error", "getaddrinfo ENOTFOUND example.com"),
    );

    const error = await captureScreenshot("https://example.com").catch((caught) => caught);
    // Without the ordering fix this would resolve DNS first and report
    // dns_error / permanent_target instead, hiding that nothing can capture.
    expect(error).toMatchObject({ code: "configuration_error" });
    expect(classifyScreenshotError(error)).toBe("permanent_configuration");
    expect(mocks.resolvePublicHost).not.toHaveBeenCalled();
  });

  it("classifies runner-rejected invocations as a configuration failure, not a bad target", async () => {
    const sandbox = createSandboxMock({ exitCode: 1, stdout: runnerFailure("invalid_arguments") });
    mocks.createSandbox.mockResolvedValue(sandbox);

    const error = await captureScreenshot("https://example.com").catch((caught) => caught);
    expect(error).toMatchObject({ code: "invalid_arguments" });
    // The same invocation is built for every target, so this can never be a
    // property of the domain — caching it as "missing" would be wrong for
    // every domain captured until the regression is fixed.
    expect(classifyScreenshotError(error)).toBe("permanent_configuration");
  });

  it("throws empty_output when the sandbox produces no image", async () => {
    const sandbox = createSandboxMock({ buffer: null });
    mocks.createSandbox.mockResolvedValue(sandbox);

    const error = await captureScreenshot("https://example.com").catch((caught) => caught);
    expect(error).toMatchObject({ code: "empty_output" });
    expect(classifyScreenshotError(error)).toBe("retryable_infrastructure");
  });

  it("rejects a captured image over the size limit", async () => {
    const sandbox = createSandboxMock({ buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
    mocks.createSandbox.mockResolvedValue(sandbox);

    const error = await captureScreenshot("https://example.com").catch((caught) => caught);
    expect(error).toMatchObject({ code: "output_too_large" });
    expect(classifyScreenshotError(error)).toBe("permanent_target");
  });

  it("treats malformed runner output as retryable infrastructure", async () => {
    const sandbox = createSandboxMock({ stdout: "not json" });
    mocks.createSandbox.mockResolvedValue(sandbox);

    const error = await captureScreenshot("https://example.com").catch((caught) => caught);
    expect(error).toMatchObject({ code: "invalid_output" });
    expect(classifyScreenshotError(error)).toBe("retryable_infrastructure");
  });

  it("treats multi-line runner output as retryable infrastructure", async () => {
    const sandbox = createSandboxMock({ stdout: "one\ntwo\n" });
    mocks.createSandbox.mockResolvedValue(sandbox);

    const error = await captureScreenshot("https://example.com").catch((caught) => caught);
    expect(error).toMatchObject({ code: "invalid_output" });
  });

  it("passes fullPage and custom dimensions through to the runner invocation", async () => {
    const sandbox = createSandboxMock();
    mocks.createSandbox.mockResolvedValue(sandbox);

    await captureScreenshot("https://example.com", {
      width: 1920,
      height: 1080,
      format: "png",
      fullPage: true,
    });

    expect(sandbox.runCommand).toHaveBeenCalledWith(
      "node",
      expect.arrayContaining([
        "--width",
        "1920",
        "--height",
        "1080",
        "--format",
        "png",
        "--full-page",
        "true",
      ]),
      { timeoutMs: 30_000 },
    );
  });
});
