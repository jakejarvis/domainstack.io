import {
  resolvePublicHost,
  SafeFetchError,
  type SafeFetchErrorCode,
} from "@domainstack/safe-fetch";

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

/** SafeFetch codes that say the target itself is unusable, not the resolver. */
const PERMANENT_RESOLVE_CODES = new Set<SafeFetchErrorCode>([
  "dns_error",
  "host_blocked",
  "host_not_allowed",
  "invalid_url",
  "private_ip",
  "protocol_not_allowed",
]);

/**
 * `resolvePublicHost` reports every lookup failure as `dns_error`, including
 * its own timeout and the resolver's temporary failures. Only a definitive
 * answer means the domain has no address; anything else would cache a working
 * domain as missing for the whole TTL.
 *
 * Node phrases these as `getaddrinfo <STATUS> <hostname>`, and the hostname is
 * the untrusted part. The status is read as an uppercase token in its fixed
 * position so a domain that merely contains one (`thenotfound.com`) cannot be
 * mistaken for the resolver's answer.
 */
const DNS_STATUS = /^\w+ ([A-Z_]+)\b/;
const DEFINITIVE_DNS_STATUSES = new Set(["ENODATA", "ENOTFOUND", "NXDOMAIN"]);
/** Raised by `resolvePublicHost` itself, so it carries no resolver status. */
const NO_ADDRESSES = "returned no records";

function isTransientDnsFailure(error: SafeFetchError): boolean {
  if (error.code !== "dns_error") return false;
  if (error.message.includes(NO_ADDRESSES)) return false;
  const status = DNS_STATUS.exec(error.message)?.[1];
  // An unrecognized message shape (the timeout, most importantly) is treated as
  // transient: retrying costs an attempt, caching a live domain as missing
  // costs a whole TTL.
  return status === undefined || !DEFINITIVE_DNS_STATUSES.has(status);
}

async function validatePublicTarget(target: URL): Promise<void> {
  try {
    await resolvePublicHost(target.hostname);
  } catch (error) {
    if (
      error instanceof SafeFetchError &&
      PERMANENT_RESOLVE_CODES.has(error.code) &&
      !isTransientDnsFailure(error)
    ) {
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
    // A timeout, connection error, or an unexpected throw is a fault in our own
    // resolution path. Treating it as a bad target would cache the domain as
    // missing for the whole TTL, so it stays retryable.
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
