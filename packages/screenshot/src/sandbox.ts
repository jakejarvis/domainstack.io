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
  "connection_reset",
  "dns_error",
  "invalid_arguments",
  "invalid_url",
  "timeout",
  "tls_error",
  "upstream_temporary",
]);

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

interface RunnerSuccess {
  success: true;
  width: number;
  height: number;
  finalUrl: string;
  durationMs: number;
  errorCode: null;
}

interface RunnerFailure {
  success: false;
  width: null;
  height: null;
  finalUrl: string | null;
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
    !(typeof result.finalUrl === "string" || result.finalUrl === null)
  ) {
    return false;
  }
  if (result.success) {
    return (
      typeof result.width === "number" &&
      typeof result.height === "number" &&
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
    const result = parseRunnerResult(await command.stdout());

    if (command.exitCode !== 0 || !result.success) {
      const code = result.success ? "command_failed" : result.errorCode;
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
  };
  if (primaryError) {
    throw new ScreenshotError(
      primaryError.code,
      primaryError.message,
      { cause: primaryError },
      errorContext,
    );
  }
  if (cleanupError) {
    throw new ScreenshotError(
      "sandbox_control_plane",
      "Failed to stop screenshot sandbox",
      { cause: cleanupError },
      errorContext,
    );
  }
  if (!successfulResult) {
    throw new ScreenshotError("capture_failed", "Screenshot capture produced no result");
  }
  return successfulResult;
}
