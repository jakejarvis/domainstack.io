import { isExpectedDnsError } from "@domainstack/safe-fetch/dns";
import { SafeFetchError } from "@domainstack/safe-fetch/errors";
import { resolvePublicHost } from "@domainstack/safe-fetch/resolve";

import { ScreenshotError } from "./errors";
import { requireSandboxImage, runSandboxCapture } from "./sandbox";

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

/**
 * Rejects a target that resolves to a private or reserved address before a
 * sandbox is paid for. The sandbox's network policy denies the same ranges at
 * connect time, which also covers DNS that changes between here and the page load.
 */
async function validatePublicTarget(target: URL): Promise<void> {
  try {
    await resolvePublicHost(target.hostname);
  } catch (error) {
    if (error instanceof SafeFetchError) {
      if (error.code === "host_blocked" || error.code === "private_ip") {
        throw new ScreenshotError("target_blocked", "Screenshot target is not publicly reachable", {
          cause: error,
        });
      }
      if (error.code === "invalid_url") {
        throw new ScreenshotError("invalid_target", "Screenshot target is not a valid host", {
          cause: error,
        });
      }
      if (isExpectedDnsError(error)) {
        throw new ScreenshotError("dns_error", "Screenshot target does not resolve", {
          cause: error,
        });
      }
    }
    // A resolver timeout or temporary failure says nothing about the target;
    // caching it as missing would blank the screenshot for a whole TTL.
    throw new ScreenshotError("upstream_temporary", "Screenshot target DNS validation failed", {
      cause: error,
    });
  }
}

export async function captureScreenshot(
  url: string,
  options: CaptureOptions = {},
): Promise<CaptureResult> {
  const target = validateTarget(url);
  // Checked before DNS so a missing or malformed image is reported as such,
  // not masked by an unrelated target failure.
  const image = requireSandboxImage();
  await validatePublicTarget(target);

  return runSandboxCapture(target.href, {
    image,
    width: options.width ?? DEFAULT_VIEWPORT_WIDTH,
    height: options.height ?? DEFAULT_VIEWPORT_HEIGHT,
    format: options.format ?? "webp",
    fullPage: options.fullPage ?? false,
  });
}
