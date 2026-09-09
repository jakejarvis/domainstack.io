import { Sandbox } from "@vercel/sandbox";

import { createLogger } from "@domainstack/logger";

import { ScreenshotError, type ScreenshotErrorCode } from "./errors";

const logger = createLogger({ source: "screenshot/sandbox" });

const SANDBOX_TIMEOUT_MS = 45_000;
const COMMAND_TIMEOUT_MS = 30_000;
const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;
const RUNNER_PATH = "/workspace/packages/screenshot-runner/dist/capture.js";
const OUTPUT_PATH = "/tmp/domainstack-screenshot";

const RUNNER_ERROR_CODES = new Set<ScreenshotErrorCode>([
  "browser_crash",
  "capture_failed",
  "configuration_error",
  "connection_reset",
  "dns_error",
  "invalid_arguments",
  "invalid_url",
  "output_too_large",
  "timeout",
  "tls_error",
  "upstream_temporary",
]);

/**
 * `validatePublicTarget` already resolved this host over the public internet
 * moments earlier, so the same lookup failing inside the sandbox points at a
 * transient network or certificate problem rather than a permanently bad
 * target. Remapping keeps those out of the cached-as-missing path; the code the
 * runner reported is preserved in the error context.
 */
const RUNNER_TRANSIENT_CODES: Partial<Record<ScreenshotErrorCode, ScreenshotErrorCode>> = {
  dns_error: "upstream_temporary",
  tls_error: "upstream_temporary",
};

const MAX_STDERR_CHARS = 2_000;

const DENIED_NETWORKS = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.88.99.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
  "::/128",
  "::1/128",
  "::ffff:0:0/96",
  "64:ff9b::/96",
  "64:ff9b:1::/48",
  "100::/64",
  "2001::/23",
  "2001:db8::/32",
  "2002::/16",
  "5f00::/16",
  "fc00::/7",
  "fe80::/10",
  "ff00::/8",
];

type AdblockStatus = "enabled" | "skipped" | "unavailable";
type ChromiumSandboxStatus = "enabled" | "disabled";

const ADBLOCK_STATUSES = new Set<AdblockStatus>(["enabled", "skipped", "unavailable"]);
const CHROMIUM_SANDBOX_STATUSES = new Set<ChromiumSandboxStatus>(["enabled", "disabled"]);

interface RunnerSuccess {
  success: true;
  width: number;
  height: number;
  finalUrl: string;
  adblock: AdblockStatus;
  chromiumSandbox: ChromiumSandboxStatus;
  durationMs: number;
  errorCode: null;
}

interface RunnerFailure {
  success: false;
  width: null;
  height: null;
  finalUrl: string | null;
  adblock: AdblockStatus;
  chromiumSandbox: ChromiumSandboxStatus | null;
  durationMs: number;
  errorCode: ScreenshotErrorCode;
}

type RunnerResult = RunnerSuccess | RunnerFailure;

export interface SandboxCaptureResult {
  buffer: Buffer;
  width: number;
  height: number;
  sandboxId: string;
  durationMs: number;
  cleanupSucceeded: boolean;
}

export interface SandboxCaptureOptions {
  width: number;
  height: number;
  format: "webp" | "png" | "jpeg";
  fullPage: boolean;
}

function isRunnerResult(value: unknown): value is RunnerResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  if (
    typeof result.success !== "boolean" ||
    typeof result.durationMs !== "number" ||
    !(typeof result.finalUrl === "string" || result.finalUrl === null) ||
    !ADBLOCK_STATUSES.has(result.adblock as AdblockStatus)
  ) {
    return false;
  }
  if (result.success) {
    return (
      typeof result.width === "number" &&
      typeof result.height === "number" &&
      CHROMIUM_SANDBOX_STATUSES.has(result.chromiumSandbox as ChromiumSandboxStatus) &&
      result.errorCode === null
    );
  }
  if (
    result.chromiumSandbox !== null &&
    !CHROMIUM_SANDBOX_STATUSES.has(result.chromiumSandbox as ChromiumSandboxStatus)
  ) {
    return false;
  }
  return (
    result.width === null &&
    result.height === null &&
    typeof result.errorCode === "string" &&
    RUNNER_ERROR_CODES.has(result.errorCode as ScreenshotErrorCode)
  );
}

/** Never lets a diagnostics read mask the failure that prompted it. */
async function readStderr(command: { stderr: () => Promise<string> }): Promise<string | null> {
  try {
    const output = (await command.stderr()).trim();
    if (!output) return null;
    return output.length > MAX_STDERR_CHARS ? `${output.slice(0, MAX_STDERR_CHARS)}…` : output;
  } catch {
    return null;
  }
}

function parseRunnerResult(stdout: string): RunnerResult {
  const lines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length !== 1) {
    throw new ScreenshotError("invalid_output", "Capture runner returned unexpected output");
  }

  try {
    const result: unknown = JSON.parse(lines[0]);
    if (!isRunnerResult(result)) throw new Error("Invalid runner result shape");
    return result;
  } catch (error) {
    throw new ScreenshotError("invalid_output", "Capture runner returned invalid JSON", {
      cause: error,
    });
  }
}

function getSandboxRegion(): string | undefined {
  return process.env.SCREENSHOT_SANDBOX_REGION?.trim() || undefined;
}

function requireSandboxImage(): string {
  const image = process.env.SCREENSHOT_SANDBOX_IMAGE?.trim();
  if (!image) {
    throw new ScreenshotError(
      "configuration_error",
      "SCREENSHOT_SANDBOX_IMAGE is required for screenshot capture",
    );
  }
  if (!/@sha256:[a-f\d]{64}$/i.test(image)) {
    throw new ScreenshotError(
      "configuration_error",
      "SCREENSHOT_SANDBOX_IMAGE must use an immutable sha256 digest",
    );
  }
  return image;
}

export async function runSandboxCapture(
  url: string,
  options: SandboxCaptureOptions,
): Promise<SandboxCaptureResult> {
  const startedAt = Date.now();
  const image = requireSandboxImage();
  let sandbox: Awaited<ReturnType<typeof Sandbox.create>> | null = null;
  let sandboxId: string | null = null;
  let exitCode: number | null = null;
  let adblock: AdblockStatus | null = null;
  let chromiumSandbox: ChromiumSandboxStatus | null = null;
  let runnerErrorCode: ScreenshotErrorCode | null = null;
  let stderr: string | null = null;
  let primaryError: ScreenshotError | undefined;
  let cleanupError: unknown;
  let cleanupSucceeded = false;
  let successfulResult: SandboxCaptureResult | null = null;

  try {
    sandbox = await Sandbox.create({
      image,
      resources: { vcpus: 2 },
      persistent: false,
      timeout: SANDBOX_TIMEOUT_MS,
      ports: [],
      region: getSandboxRegion(),
      networkPolicy: {
        allow: { "*": [] },
        subnets: { deny: DENIED_NETWORKS },
      },
    });
    sandboxId = sandbox.name;

    const command = await sandbox.runCommand(
      "node",
      [
        RUNNER_PATH,
        "--url",
        url,
        "--width",
        String(options.width),
        "--height",
        String(options.height),
        "--format",
        options.format,
        "--output",
        OUTPUT_PATH,
        "--full-page",
        String(options.fullPage),
      ],
      { timeoutMs: COMMAND_TIMEOUT_MS },
    );
    exitCode = command.exitCode;
    const stdout = await command.stdout();
    if (command.exitCode !== 0) stderr = await readStderr(command);

    const result = parseRunnerResult(stdout);
    adblock = result.adblock;
    chromiumSandbox = result.chromiumSandbox;

    if (command.exitCode !== 0 || !result.success) {
      runnerErrorCode = result.success ? null : result.errorCode;
      const reported = result.success ? "command_failed" : result.errorCode;
      const code = RUNNER_TRANSIENT_CODES[reported] ?? reported;
      throw new ScreenshotError(code, `Capture runner failed with exit code ${command.exitCode}`);
    }

    const buffer = await sandbox.readFileToBuffer({ path: OUTPUT_PATH });
    if (!buffer || buffer.length === 0) {
      throw new ScreenshotError("empty_output", "Capture runner did not produce an image");
    }
    if (buffer.length > MAX_SCREENSHOT_BYTES) {
      throw new ScreenshotError("output_too_large", "Captured image exceeds the size limit");
    }

    successfulResult = {
      buffer,
      width: result.width,
      height: result.height,
      sandboxId,
      durationMs: Date.now() - startedAt,
      cleanupSucceeded: false,
    };
  } catch (error) {
    primaryError =
      error instanceof ScreenshotError
        ? error
        : new ScreenshotError("sandbox_control_plane", "Sandbox screenshot capture failed", {
            cause: error,
          });
  } finally {
    if (sandbox) {
      try {
        await sandbox.stop();
        cleanupSucceeded = true;
        if (successfulResult) {
          successfulResult.cleanupSucceeded = true;
          successfulResult.durationMs = Date.now() - startedAt;
        }
      } catch (error) {
        cleanupError = error;
        logger.warn(
          { err: error, sandboxId, durationMs: Date.now() - startedAt, exitCode },
          "failed to stop screenshot sandbox",
        );
      }
    }

    logger.info(
      {
        sandboxId,
        durationMs: Date.now() - startedAt,
        exitCode,
        adblock,
        chromiumSandbox,
        runnerErrorCode,
        stderr,
        errorCode: primaryError
          ? primaryError instanceof ScreenshotError
            ? primaryError.code
            : "sandbox_control_plane"
          : null,
        cleanupSucceeded,
      },
      "screenshot sandbox capture finished",
    );
  }

  const errorContext = {
    sandboxId,
    durationMs: Date.now() - startedAt,
    exitCode,
    cleanupSucceeded,
    runnerErrorCode,
    stderr,
  };
  if (primaryError) {
    throw new ScreenshotError(
      primaryError.code,
      primaryError.message,
      { cause: primaryError },
      errorContext,
    );
  }
  if (!successfulResult) {
    throw new ScreenshotError(
      "sandbox_control_plane",
      cleanupError ? "Failed to stop screenshot sandbox" : "Screenshot capture produced no result",
      cleanupError ? { cause: cleanupError } : undefined,
      errorContext,
    );
  }
  // A stop() failure after the image is already in hand only leaks a sandbox
  // that the platform reclaims on timeout anyway. Discarding a valid capture
  // would buy nothing and cost a full retry, so it is reported instead.
  return successfulResult;
}
