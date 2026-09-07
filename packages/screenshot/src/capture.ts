import { resolvePublicHost, SafeFetchError } from "@domainstack/safe-fetch";

import { ScreenshotError } from "./errors";
import { runSandboxCapture } from "./sandbox";

const DEFAULT_VIEWPORT_WIDTH = 1200;
const DEFAULT_VIEWPORT_HEIGHT = 630;

export interface CaptureOptions {
  width?: number;
  height?: number;
  format?: "webp" | "png" | "jpeg";
  fullPage?: boolean;
}

export interface CaptureResult {
  buffer: Buffer;
  width: number;
  height: number;
  sandboxId: string;
  durationMs: number;
  cleanupSucceeded: boolean;
}

function validateTarget(url: string): URL {
  let target: URL;
  try {
    target = new URL(url);
  } catch (error) {
    throw new ScreenshotError("invalid_url", "Screenshot target is not a valid URL", {
      cause: error,
    });
  }
  if (target.protocol !== "https:") {
    throw new ScreenshotError("invalid_url", "Screenshot target must use HTTPS");
  }
  if (target.username || target.password) {
    throw new ScreenshotError("invalid_url", "Screenshot target must not contain credentials");
  }
  return target;
}

async function validatePublicTarget(target: URL): Promise<void> {
  try {
    await resolvePublicHost(target.hostname);
  } catch (error) {
    if (error instanceof SafeFetchError) {
      const code =
        error.code === "dns_error"
          ? "dns_error"
          : error.code === "host_blocked" || error.code === "private_ip"
            ? "target_blocked"
            : "invalid_target";
      throw new ScreenshotError(code, "Screenshot target is not publicly reachable", {
        cause: error,
      });
    }
    throw new ScreenshotError("dns_error", "Screenshot target DNS validation failed", {
      cause: error,
    });
  }
}

export async function captureScreenshot(
  url: string,
  options: CaptureOptions = {},
): Promise<CaptureResult> {
  const target = validateTarget(url);
  await validatePublicTarget(target);

  return runSandboxCapture(target.href, {
    width: options.width ?? DEFAULT_VIEWPORT_WIDTH,
    height: options.height ?? DEFAULT_VIEWPORT_HEIGHT,
    format: options.format ?? "webp",
    fullPage: options.fullPage ?? false,
  });
}

export async function captureScreenshotBase64(
  url: string,
  options: CaptureOptions = {},
): Promise<{
  imageBase64: string;
  width: number;
  height: number;
  sandboxId: string;
  durationMs: number;
  cleanupSucceeded: boolean;
}> {
  const result = await captureScreenshot(url, options);
  return {
    imageBase64: result.buffer.toString("base64"),
    width: result.width,
    height: result.height,
    sandboxId: result.sandboxId,
    durationMs: result.durationMs,
    cleanupSucceeded: result.cleanupSucceeded,
  };
}
