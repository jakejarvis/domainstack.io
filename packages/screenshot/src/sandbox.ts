import { APIError, Sandbox } from "@vercel/sandbox";

import { createLogger } from "@domainstack/logger";

import { ScreenshotError, type ScreenshotErrorCode } from "./errors";

const logger = createLogger({ source: "screenshot/sandbox" });

const SANDBOX_TIMEOUT_MS = 45_000;
const COMMAND_TIMEOUT_MS = 30_000;
const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;
// The runner image has no build step: Node strips the types at load time.
const RUNNER_PATH = "/workspace/packages/screenshot-runner/src/capture.ts";
const OUTPUT_PATH = "/tmp/domainstack-screenshot";

const RUNNER_ERROR_CODES = new Set<ScreenshotErrorCode>([
  "browser_crash",
  "capture_failed",
  "connection_reset",
  "dns_error",
  "invalid_arguments",
  "invalid_url",
  "output_too_large",
  "timeout",
  "tls_error",
  "upstream_temporary",
]);

// The target already resolved cleanly moments earlier in validatePublicTarget,
// so a runner-reported dns_error here is a flake, not a dead domain.
const RUNNER_TRANSIENT_CODES: Partial<Record<ScreenshotErrorCode, ScreenshotErrorCode>> = {
  dns_error: "upstream_temporary",
};

const MAX_STDERR_CHARS = 2_000;

// Vercel Sandbox accepts only IPv4 CIDRs here: an IPv6 entry fails
// Sandbox.create with 400 `Invalid CIDR "::/128"`. Private IPv6 answers are
// still rejected before a sandbox exists, by resolvePublicHost in capture.ts.
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
];

type AdblockStatus = "enabled" | "skipped" | "unavailable";

const ADBLOCK_STATUSES = new Set<AdblockStatus>(["enabled", "skipped", "unavailable"]);

interface RunnerSuccess {
  success: true;
  width: number;
  height: number;
  finalUrl: string;
  adblock: AdblockStatus;
  browserVersion: string;
  durationMs: number;
  errorCode: null;
}

interface RunnerFailure {
  success: false;
  width: null;
  height: null;
  finalUrl: string | null;
  adblock: AdblockStatus;
  browserVersion: string | null;
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
  /** Already validated by `requireSandboxImage()`. */
  image: string;
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
    !ADBLOCK_STATUSES.has(result.adblock as AdblockStatus) ||
    !(typeof result.browserVersion === "string" || result.browserVersion === null)
  ) {
    return false;
  }
  if (result.success) {
    return (
      typeof result.width === "number" &&
      typeof result.height === "number" &&
      typeof result.browserVersion === "string" &&
      result.errorCode === null
    );
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

/**
 * Called by `capture.ts` before DNS, so `runSandboxCapture` below always
 * receives an already-validated image and never has to throw before its own
 * try/finally.
 */
export function requireSandboxImage(): string {
  const image = process.env.SCREENSHOT_SANDBOX_IMAGE?.trim();
  if (!image) {
    throw new ScreenshotError("not_configured", "SCREENSHOT_SANDBOX_IMAGE is not set");
  }
  if (!/@sha256:[a-f\d]{64}$/i.test(image)) {
    throw new ScreenshotError(
      "configuration_error",
      "SCREENSHOT_SANDBOX_IMAGE must use an immutable sha256 digest",
    );
  }
  return image;
}

/** Retrying can't fix an image the project can't use: wrong, unshared, not yet Ready, or unauthorized. */
function isImageConfigurationError(error: unknown): boolean {
  if (!(error instanceof APIError)) return false;
  const { status } = error.response;
  if (status === 401 || status === 403 || status === 404) return true;
  return JSON.stringify(error.json ?? error.text ?? "").includes("image_not_ready");
}

async function createCaptureSandbox(image: string) {
  try {
    return await Sandbox.create({
      image,
      resources: { vcpus: 2 },
      persistent: false,
      timeout: SANDBOX_TIMEOUT_MS,
      ports: [],
      networkPolicy: {
        allow: { "*": [] },
        subnets: { deny: DENIED_NETWORKS },
      },
    });
  } catch (error) {
    if (isImageConfigurationError(error)) {
      throw new ScreenshotError(
        "configuration_error",
        "Sandbox rejected the screenshot runner image",
        { cause: error },
      );
    }
    throw error;
  }
}

export async function runSandboxCapture(
  url: string,
  options: SandboxCaptureOptions,
): Promise<SandboxCaptureResult> {
  const startedAt = Date.now();
  const { image } = options;
  let sandbox: Awaited<ReturnType<typeof Sandbox.create>> | null = null;
  let sandboxId: string | null = null;
  let exitCode: number | null = null;
  let adblock: AdblockStatus | null = null;
  let browserVersion: string | null = null;
  let runnerErrorCode: ScreenshotErrorCode | null = null;
  let stderr: string | null = null;
  let activeCpuUsageMs: number | null = null;
  let primaryError: ScreenshotError | undefined;
  let cleanupError: unknown;
  let cleanupSucceeded = false;
  let successfulResult: SandboxCaptureResult | null = null;

  try {
    sandbox = await createCaptureSandbox(image);
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
    browserVersion = result.browserVersion;

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
        // Only reported once the VM is stopped.
        activeCpuUsageMs = sandbox.activeCpuUsageMs ?? null;
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
        browserVersion,
        runnerErrorCode,
        stderr,
        errorCode: primaryError
          ? primaryError instanceof ScreenshotError
            ? primaryError.code
            : "sandbox_control_plane"
          : null,
        cleanupSucceeded,
        activeCpuUsageMs,
      },
      "screenshot sandbox capture finished",
    );
  }

  const errorContext = {
    sandboxId,
    durationMs: Date.now() - startedAt,
    exitCode,
    cleanupSucceeded,
    activeCpuUsageMs,
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
