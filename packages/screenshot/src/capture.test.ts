import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SafeFetchError } from "@domainstack/safe-fetch/errors";

const mocks = vi.hoisted(() => {
  // Mirrors the parts of the SDK's APIError that sandbox.ts reads.
  class MockAPIError extends Error {
    constructor(
      readonly response: { status: number },
      readonly json?: unknown,
    ) {
      super("api error");
    }
  }

  return {
    MockAPIError,
    createSandbox: vi.fn<(options: Record<string, unknown>) => Promise<unknown>>(),
    loggerInfo: vi.fn<(bindings: Record<string, unknown>, message: string) => void>(),
    loggerWarn: vi.fn<(bindings: Record<string, unknown>, message: string) => void>(),
    resolvePublicHost: vi.fn<(hostname: string) => Promise<unknown>>(),
    // Background work handed to waitUntil, so tests decide when to await it.
    pendingCleanups: [] as Promise<unknown>[],
  };
});

vi.mock("@domainstack/logger", () => ({
  createLogger: () => ({ info: mocks.loggerInfo, warn: mocks.loggerWarn }),
}));

vi.mock("@vercel/functions", () => ({
  waitUntil: (promise: Promise<unknown>) => {
    mocks.pendingCleanups.push(promise);
  },
}));

vi.mock("@vercel/sandbox", () => ({
  APIError: mocks.MockAPIError,
  Sandbox: { create: mocks.createSandbox },
}));

vi.mock("@domainstack/safe-fetch/resolve", () => ({
  resolvePublicHost: mocks.resolvePublicHost,
}));

import {
  captureScreenshot,
  classifyScreenshotError,
  ScreenshotError,
  type ScreenshotErrorClassification,
  type ScreenshotErrorCode,
} from "./index";

const IMAGE = `domainstack-screenshot@sha256:${"a".repeat(64)}`;

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
  deleteError?: Error;
}) {
  const stop = vi.fn<() => Promise<void>>();
  if (options?.stopError) stop.mockRejectedValue(options.stopError);
  else stop.mockResolvedValue(undefined);
  const deleteSandbox = vi.fn<() => Promise<void>>();
  if (options?.deleteError) deleteSandbox.mockRejectedValue(options.deleteError);
  else deleteSandbox.mockResolvedValue(undefined);
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
  // so presence is checked instead: that's exactly the empty_output case.
  const readFileToBuffer = vi
    .fn<() => Promise<Buffer | null>>()
    .mockResolvedValue(options && "buffer" in options ? options.buffer! : Buffer.from("webp"));
  return {
    name: "sbx_test",
    activeCpuUsageMs: 1234,
    runCommand,
    readFileToBuffer,
    stop,
    delete: deleteSandbox,
  };
}

function dnsError(message: string, causeCode?: string) {
  return new SafeFetchError(
    "dns_error",
    message,
    undefined,
    causeCode ? { cause: Object.assign(new Error(message), { code: causeCode }) } : undefined,
  );
}

async function captureError(url = "https://example.com") {
  return captureScreenshot(url).catch((caught: unknown) => caught);
}

/** Waits for the stop/delete/log work the capture handed to waitUntil. */
async function flushCleanups() {
  await Promise.all(mocks.pendingCleanups.splice(0));
}

describe("captureScreenshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pendingCleanups.length = 0;
    vi.stubEnv("SCREENSHOT_SANDBOX_IMAGE", IMAGE);
    mocks.resolvePublicHost.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("input validation", () => {
    it("rejects non-HTTPS targets before DNS or sandbox creation", async () => {
      const error = await captureError("http://example.com");

      expect(error).toMatchObject({ code: "invalid_url" });
      expect(classifyScreenshotError(error)).toBe("permanent_target");
      expect(mocks.resolvePublicHost).not.toHaveBeenCalled();
      expect(mocks.createSandbox).not.toHaveBeenCalled();
    });

    it("rejects targets that carry credentials", async () => {
      await expect(captureError("https://user:pass@example.com")).resolves.toMatchObject({
        code: "invalid_url",
      });
      expect(mocks.createSandbox).not.toHaveBeenCalled();
    });
  });

  describe("sandbox image configuration", () => {
    it("reports an unset image as not_configured, before DNS", async () => {
      vi.stubEnv("SCREENSHOT_SANDBOX_IMAGE", undefined);
      // A bad target must not mask the missing image.
      mocks.resolvePublicHost.mockRejectedValue(dnsError("getaddrinfo ENOTFOUND x", "ENOTFOUND"));

      const error = await captureError();

      expect(error).toMatchObject({ code: "not_configured" });
      expect(classifyScreenshotError(error)).toBe("not_configured");
      expect(mocks.resolvePublicHost).not.toHaveBeenCalled();
      expect(mocks.createSandbox).not.toHaveBeenCalled();
    });

    it("treats a blank image like an unset one", async () => {
      vi.stubEnv("SCREENSHOT_SANDBOX_IMAGE", "   ");

      const error = await captureError();

      expect(error).toMatchObject({ code: "not_configured" });
      expect(mocks.createSandbox).not.toHaveBeenCalled();
    });

    it("requires an immutable image reference", async () => {
      vi.stubEnv("SCREENSHOT_SANDBOX_IMAGE", "domainstack-screenshot:latest");

      const error = await captureError();

      expect(error).toMatchObject({ code: "configuration_error" });
      // A broken deployment is neither retried nor cached against the domain.
      expect(classifyScreenshotError(error)).toBe("configuration");
      expect(mocks.resolvePublicHost).not.toHaveBeenCalled();
      expect(mocks.createSandbox).not.toHaveBeenCalled();
    });
  });

  describe("public address pre-check", () => {
    it.each(["private_ip", "host_blocked"] as const)(
      "blocks a target rejected as %s without creating a sandbox",
      async (code) => {
        mocks.resolvePublicHost.mockRejectedValue(new SafeFetchError(code, "blocked"));

        const error = await captureError();

        expect(error).toMatchObject({ code: "target_blocked" });
        expect(classifyScreenshotError(error)).toBe("permanent_target");
        expect(mocks.createSandbox).not.toHaveBeenCalled();
      },
    );

    it("rejects an invalid host as invalid_target", async () => {
      mocks.resolvePublicHost.mockRejectedValue(new SafeFetchError("invalid_url", "bad host"));

      const error = await captureError();

      expect(error).toMatchObject({ code: "invalid_target" });
      expect(classifyScreenshotError(error)).toBe("permanent_target");
      expect(mocks.createSandbox).not.toHaveBeenCalled();
    });

    it.each([
      ["an ENOTFOUND cause", () => dnsError("getaddrinfo ENOTFOUND example.com", "ENOTFOUND")],
      ["an ENODATA cause", () => dnsError("queryA ENODATA example.com", "ENODATA")],
      ["an empty answer", () => new SafeFetchError("dns_error", "DNS lookup returned no records")],
    ])("caches a definitive DNS failure (%s)", async (_label, makeError) => {
      mocks.resolvePublicHost.mockRejectedValue(makeError());

      const error = await captureError();

      expect(error).toMatchObject({ code: "dns_error" });
      expect(classifyScreenshotError(error)).toBe("permanent_target");
      expect(mocks.createSandbox).not.toHaveBeenCalled();
    });

    // resolvePublicHost reports its own timeout and the resolver's temporary
    // failures under the same code as a genuine NXDOMAIN.
    it.each([
      ["the resolver timeout", () => dnsError("DNS lookup timed out after 8000ms")],
      ["EAI_AGAIN", () => dnsError("getaddrinfo EAI_AGAIN example.com", "EAI_AGAIN")],
      ["ESERVFAIL", () => dnsError("queryA ESERVFAIL example.com", "ESERVFAIL")],
      ["an unexpected throw", () => new Error("resolver exploded")],
    ])("keeps a transient DNS failure retryable (%s)", async (_label, makeError) => {
      mocks.resolvePublicHost.mockRejectedValue(makeError());

      const error = await captureError();

      expect(error).toMatchObject({ code: "upstream_temporary" });
      expect(classifyScreenshotError(error)).toBe("transient_target");
      expect(mocks.createSandbox).not.toHaveBeenCalled();
    });
  });

  describe("sandbox creation", () => {
    it("creates an ephemeral restricted sandbox and returns the capture", async () => {
      const sandbox = createSandboxMock();
      mocks.createSandbox.mockResolvedValue(sandbox);

      await expect(captureScreenshot("https://example.com")).resolves.toMatchObject({
        buffer: Buffer.from("webp"),
        width: 1200,
        height: 630,
        sandboxId: "sbx_test",
      });

      expect(mocks.createSandbox).toHaveBeenCalledWith(
        expect.objectContaining({
          image: IMAGE,
          resources: { vcpus: 2 },
          persistent: false,
          timeout: 45_000,
          ports: [],
          networkPolicy: expect.objectContaining({
            allow: { "*": [] },
            subnets: {
              deny: expect.arrayContaining(["127.0.0.0/8", "169.254.0.0/16"]),
            },
          }),
        }),
      );
      expect(mocks.createSandbox.mock.calls[0]?.[0]).not.toHaveProperty("region");
      expect(sandbox.runCommand).toHaveBeenCalledWith(
        "node",
        expect.arrayContaining([
          "/workspace/packages/screenshot-runner/src/capture.ts",
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

      await flushCleanups();
      expect(sandbox.stop).toHaveBeenCalledOnce();
      // stop() ends the VM; delete() then removes the stopped sandbox record.
      expect(sandbox.delete).toHaveBeenCalledOnce();
      expect(sandbox.stop.mock.invocationCallOrder[0]).toBeLessThan(
        sandbox.delete.mock.invocationCallOrder[0],
      );
    });

    it("denies only IPv4 ranges, which is all the Sandbox API accepts", async () => {
      mocks.createSandbox.mockResolvedValue(createSandboxMock());

      await captureScreenshot("https://example.com");

      const options = mocks.createSandbox.mock.calls[0]?.[0] as {
        networkPolicy: { subnets: { deny: string[] } };
      };
      const { deny } = options.networkPolicy.subnets;
      expect(deny).toHaveLength(15);
      for (const cidr of deny) {
        expect(cidr).toMatch(/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/);
      }
    });

    it("logs the sandbox's active CPU time as the cost signal", async () => {
      mocks.createSandbox.mockResolvedValue(createSandboxMock());

      await captureScreenshot("https://example.com");
      await flushCleanups();

      expect(mocks.loggerInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          sandboxId: "sbx_test",
          cleanupSucceeded: true,
          deleted: true,
          activeCpuUsageMs: 1234,
        }),
        "screenshot sandbox capture finished",
      );
    });

    it("returns the capture without waiting for the sandbox to stop", async () => {
      const sandbox = createSandboxMock();
      // A stop() that never settles would hang the capture if it were awaited.
      sandbox.stop.mockReturnValue(new Promise(() => {}));
      mocks.createSandbox.mockResolvedValue(sandbox);

      await expect(captureScreenshot("https://example.com")).resolves.toMatchObject({
        buffer: Buffer.from("webp"),
      });

      expect(mocks.pendingCleanups).toHaveLength(1);
      expect(sandbox.stop).toHaveBeenCalledOnce();
      expect(sandbox.delete).not.toHaveBeenCalled();
      // Not flushed: the pending stop() never settles.
    });

    it("cleans up in the background after a failed capture too", async () => {
      const sandbox = createSandboxMock({ exitCode: 1, stdout: runnerFailure("tls_error") });
      mocks.createSandbox.mockResolvedValue(sandbox);

      const error = await captureError();

      expect(error).toMatchObject({ code: "tls_error" });
      expect(mocks.pendingCleanups).toHaveLength(1);

      await flushCleanups();
      expect(sandbox.stop).toHaveBeenCalledOnce();
      expect(sandbox.delete).toHaveBeenCalledOnce();
      expect(mocks.loggerInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          sandboxId: "sbx_test",
          errorCode: "tls_error",
          cleanupSucceeded: true,
          deleted: true,
        }),
        "screenshot sandbox capture finished",
      );
    });

    it("does not try to delete a sandbox that was never created", async () => {
      mocks.createSandbox.mockRejectedValue(new mocks.MockAPIError({ status: 500 }));

      await captureError();

      // No sandbox object exists to assert on, so the finish log is the evidence.
      // It is written immediately: there is no background cleanup to wait for.
      expect(mocks.pendingCleanups).toHaveLength(0);
      expect(mocks.loggerInfo).toHaveBeenCalledWith(
        expect.objectContaining({ sandboxId: null, cleanupSucceeded: false, deleted: false }),
        "screenshot sandbox capture finished",
      );
      expect(mocks.loggerWarn).not.toHaveBeenCalledWith(
        expect.anything(),
        "failed to delete screenshot sandbox",
      );
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

    it.each([
      ["a 404 (unknown or unshared image)", () => new mocks.MockAPIError({ status: 404 })],
      ["a 401", () => new mocks.MockAPIError({ status: 401 })],
      ["a 403", () => new mocks.MockAPIError({ status: 403 })],
      [
        "image_not_ready",
        () => new mocks.MockAPIError({ status: 400 }, { error: { code: "image_not_ready" } }),
      ],
    ])("treats %s as a configuration failure", async (_label, makeError) => {
      mocks.createSandbox.mockRejectedValue(makeError());

      const error = await captureError();

      expect(error).toMatchObject({ code: "configuration_error" });
      expect(classifyScreenshotError(error)).toBe("configuration");
    });

    it.each([
      ["a 500", () => new mocks.MockAPIError({ status: 500 })],
      ["a 400 for another reason", () => new mocks.MockAPIError({ status: 400 }, { error: {} })],
      ["a plain error", () => new Error("control plane unavailable")],
    ])("treats %s as a control plane failure", async (_label, makeError) => {
      mocks.createSandbox.mockRejectedValue(makeError());

      const error = await captureError();

      expect(error).toMatchObject({ code: "sandbox_control_plane" });
      expect(classifyScreenshotError(error)).toBe("infrastructure");
    });

    it("keeps a 404 after creation (a timed-out sandbox) a control plane failure", async () => {
      const sandbox = createSandboxMock();
      sandbox.runCommand.mockRejectedValue(new mocks.MockAPIError({ status: 404 }));
      mocks.createSandbox.mockResolvedValue(sandbox);

      const error = await captureError();

      expect(error).toMatchObject({ code: "sandbox_control_plane" });
      expect(classifyScreenshotError(error)).toBe("infrastructure");

      await flushCleanups();
      expect(sandbox.stop).toHaveBeenCalledOnce();
    });
  });

  describe("runner failures", () => {
    it("does not remap a runner tls_error: a bad certificate belongs to the site", async () => {
      mocks.createSandbox.mockResolvedValue(
        createSandboxMock({ exitCode: 1, stdout: runnerFailure("tls_error") }),
      );

      const error = await captureError();

      expect(error).toMatchObject({ code: "tls_error" });
      expect(classifyScreenshotError(error)).toBe("permanent_target");
    });

    // The pre-check already resolved the name, so the same lookup failing
    // inside the sandbox is a flake and must not cache the domain as missing.
    it("remaps a runner dns_error to upstream_temporary", async () => {
      mocks.createSandbox.mockResolvedValue(
        createSandboxMock({ exitCode: 1, stdout: runnerFailure("dns_error") }),
      );

      const error = await captureError();

      expect(error).toMatchObject({
        code: "upstream_temporary",
        context: expect.objectContaining({ runnerErrorCode: "dns_error" }),
      });
      expect(classifyScreenshotError(error)).toBe("transient_target");
    });

    it("preserves a permanent runner failure when sandbox cleanup also fails", async () => {
      const sandbox = createSandboxMock({
        exitCode: 1,
        stdout: runnerFailure("invalid_url"),
        stopError: new Error("stop failed"),
      });
      mocks.createSandbox.mockResolvedValue(sandbox);

      const error = await captureError();

      expect(error).toBeInstanceOf(ScreenshotError);
      expect(error).toMatchObject({ code: "invalid_url" });
      expect(classifyScreenshotError(error)).toBe("permanent_target");

      await flushCleanups();
      expect(sandbox.stop).toHaveBeenCalledOnce();
    });

    it("classifies a runner-rejected invocation as configuration, not a bad target", async () => {
      mocks.createSandbox.mockResolvedValue(
        createSandboxMock({ exitCode: 1, stdout: runnerFailure("invalid_arguments") }),
      );

      const error = await captureError();

      expect(error).toMatchObject({ code: "invalid_arguments" });
      // The same invocation is built for every target, so this can never be a
      // property of the domain.
      expect(classifyScreenshotError(error)).toBe("configuration");
    });

    it("treats a non-zero exit with a success payload as command_failed", async () => {
      mocks.createSandbox.mockResolvedValue(createSandboxMock({ exitCode: 1 }));

      const error = await captureError();

      expect(error).toMatchObject({ code: "command_failed" });
      expect(classifyScreenshotError(error)).toBe("infrastructure");
    });

    it("attaches truncated runner stderr to the failure context", async () => {
      mocks.createSandbox.mockResolvedValue(
        createSandboxMock({
          exitCode: 1,
          stdout: runnerFailure("capture_failed"),
          stderr: "  chromium exploded  ",
        }),
      );

      const error = await captureError();

      expect(error).toMatchObject({
        context: expect.objectContaining({
          stderr: "chromium exploded",
          sandboxId: "sbx_test",
        }),
      });
    });
  });

  describe("sandbox output", () => {
    it("rejects a captured image over the size limit as permanent", async () => {
      mocks.createSandbox.mockResolvedValue(
        createSandboxMock({ buffer: Buffer.alloc(10 * 1024 * 1024 + 1) }),
      );

      const error = await captureError();

      expect(error).toMatchObject({ code: "output_too_large" });
      expect(classifyScreenshotError(error)).toBe("permanent_target");
    });

    it("throws empty_output when the sandbox produces no image", async () => {
      mocks.createSandbox.mockResolvedValue(createSandboxMock({ buffer: null }));

      const error = await captureError();

      expect(error).toMatchObject({ code: "empty_output" });
      expect(classifyScreenshotError(error)).toBe("infrastructure");
    });

    it("treats malformed runner output as infrastructure", async () => {
      mocks.createSandbox.mockResolvedValue(createSandboxMock({ stdout: "not json" }));

      const error = await captureError();

      expect(error).toMatchObject({ code: "invalid_output" });
      expect(classifyScreenshotError(error)).toBe("infrastructure");
    });

    it("treats multi-line runner output as infrastructure", async () => {
      mocks.createSandbox.mockResolvedValue(createSandboxMock({ stdout: "one\ntwo\n" }));

      const error = await captureError();

      expect(error).toMatchObject({ code: "invalid_output" });
    });

    it("keeps the captured image when stopping the sandbox fails", async () => {
      const sandbox = createSandboxMock({ stopError: new Error("stop failed") });
      mocks.createSandbox.mockResolvedValue(sandbox);

      await expect(captureScreenshot("https://example.com")).resolves.toMatchObject({
        buffer: Buffer.from("webp"),
      });

      await flushCleanups();
      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        expect.objectContaining({ sandboxId: "sbx_test" }),
        "failed to stop screenshot sandbox",
      );
      // Deleting also ends any session still running, so it is still attempted.
      expect(sandbox.delete).toHaveBeenCalledOnce();
      expect(mocks.loggerInfo).toHaveBeenCalledWith(
        expect.objectContaining({ cleanupSucceeded: false, deleted: true, activeCpuUsageMs: null }),
        "screenshot sandbox capture finished",
      );
    });

    it("keeps the capture when deleting the sandbox fails", async () => {
      mocks.createSandbox.mockResolvedValue(
        createSandboxMock({ deleteError: new Error("delete failed") }),
      );

      await expect(captureScreenshot("https://example.com")).resolves.toMatchObject({
        buffer: Buffer.from("webp"),
      });

      await flushCleanups();
      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        expect.objectContaining({ sandboxId: "sbx_test" }),
        "failed to delete screenshot sandbox",
      );
      expect(mocks.loggerInfo).toHaveBeenCalledWith(
        expect.objectContaining({ cleanupSucceeded: true, deleted: false }),
        "screenshot sandbox capture finished",
      );
    });
  });
});

describe("classifyScreenshotError", () => {
  const expected: Record<ScreenshotErrorCode, ScreenshotErrorClassification> = {
    dns_error: "permanent_target",
    invalid_target: "permanent_target",
    invalid_url: "permanent_target",
    output_too_large: "permanent_target",
    target_blocked: "permanent_target",
    timeout: "permanent_target",
    tls_error: "permanent_target",
    capture_failed: "transient_target",
    connection_reset: "transient_target",
    upstream_temporary: "transient_target",
    browser_crash: "infrastructure",
    command_failed: "infrastructure",
    empty_output: "infrastructure",
    invalid_output: "infrastructure",
    sandbox_control_plane: "infrastructure",
    configuration_error: "configuration",
    invalid_arguments: "configuration",
    not_configured: "not_configured",
  };

  it.each(Object.entries(expected) as [ScreenshotErrorCode, ScreenshotErrorClassification][])(
    "maps %s to %s",
    (code, classification) => {
      expect(classifyScreenshotError(new ScreenshotError(code, "x"))).toBe(classification);
    },
  );

  it("treats anything that is not a ScreenshotError as infrastructure", () => {
    expect(classifyScreenshotError(new Error("boom"))).toBe("infrastructure");
    expect(classifyScreenshotError("boom")).toBe("infrastructure");
  });
});
