export type ScreenshotErrorCode =
  | "browser_crash"
  | "capture_failed"
  | "command_failed"
  | "configuration_error"
  | "connection_reset"
  | "dns_error"
  | "empty_output"
  | "invalid_arguments"
  | "invalid_output"
  | "invalid_target"
  | "invalid_url"
  | "not_configured"
  | "output_too_large"
  | "sandbox_control_plane"
  | "target_blocked"
  | "timeout"
  | "tls_error"
  | "upstream_temporary";

/**
 * What the workflow should do about a failure:
 * - `permanent_target`: a property of the site, so a retry cannot help; cache the miss.
 * - `transient_target`: possibly a hiccup on the site; retry, then cache the miss on the last attempt.
 * - `infrastructure`: our side broke; retry, and never cache (a TTL-long miss would blank the domain).
 * - `configuration`: this deployment is broken; retrying cannot help, and the domain is not at fault.
 * - `not_configured`: no runner image is set (normal in local development); skip quietly, never cache.
 */
export type ScreenshotErrorClassification =
  | "permanent_target"
  | "transient_target"
  | "infrastructure"
  | "configuration"
  | "not_configured";

export interface ScreenshotErrorContext {
  sandboxId: string | null;
  durationMs: number;
  exitCode: number | null;
  cleanupSucceeded: boolean;
  /** Active CPU time the sandbox reported once stopped: the per-capture cost signal. */
  activeCpuUsageMs?: number | null;
  /** Code the runner reported, when it differs from the classified code. */
  runnerErrorCode?: ScreenshotErrorCode | null;
  /** Truncated runner stderr, kept for diagnosing opaque command failures. */
  stderr?: string | null;
}

const PERMANENT_TARGET_CODES = new Set<ScreenshotErrorCode>([
  "dns_error",
  "invalid_target",
  "invalid_url",
  // A capture that exceeds the size limit will do so again on every attempt.
  "output_too_large",
  "target_blocked",
  "timeout",
  "tls_error",
]);

const TRANSIENT_TARGET_CODES = new Set<ScreenshotErrorCode>([
  "capture_failed",
  "connection_reset",
  "upstream_temporary",
]);

// `invalid_arguments` means the runner rejected its own CLI invocation: a bug
// in how sandbox.ts calls it, never a property of the target domain.
const CONFIGURATION_CODES = new Set<ScreenshotErrorCode>([
  "configuration_error",
  "invalid_arguments",
]);

export class ScreenshotError extends Error {
  readonly name = "ScreenshotError";

  constructor(
    readonly code: ScreenshotErrorCode,
    message: string,
    options?: ErrorOptions,
    readonly context?: ScreenshotErrorContext,
  ) {
    super(message, options);
  }
}

export function classifyScreenshotError(error: unknown): ScreenshotErrorClassification {
  if (!(error instanceof ScreenshotError)) return "infrastructure";
  if (error.code === "not_configured") return "not_configured";
  if (CONFIGURATION_CODES.has(error.code)) return "configuration";
  if (PERMANENT_TARGET_CODES.has(error.code)) return "permanent_target";
  if (TRANSIENT_TARGET_CODES.has(error.code)) return "transient_target";
  return "infrastructure";
}

export function getScreenshotErrorCode(error: unknown): ScreenshotErrorCode {
  return error instanceof ScreenshotError ? error.code : "sandbox_control_plane";
}

export function getScreenshotErrorContext(error: unknown): ScreenshotErrorContext | undefined {
  return error instanceof ScreenshotError ? error.context : undefined;
}
