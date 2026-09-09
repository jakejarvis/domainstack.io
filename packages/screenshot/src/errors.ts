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
  | "output_too_large"
  | "sandbox_control_plane"
  | "target_blocked"
  | "timeout"
  | "tls_error"
  | "upstream_temporary";

/**
 * `permanent_target` means the target itself is unusable, so the failure is
 * worth caching. `permanent_configuration` means this deployment is broken —
 * retrying cannot help, but the target is not at fault and must not be cached
 * as missing. Everything else is assumed transient.
 */
export type ScreenshotErrorClassification =
  | "permanent_configuration"
  | "permanent_target"
  | "retryable_infrastructure";

export interface ScreenshotErrorContext {
  sandboxId: string | null;
  durationMs: number;
  exitCode: number | null;
  cleanupSucceeded: boolean;
  /** Code the runner reported, when it differs from the classified code. */
  runnerErrorCode?: ScreenshotErrorCode | null;
  /** Truncated runner stderr, kept for diagnosing opaque command failures. */
  stderr?: string | null;
}

const PERMANENT_TARGET_CODES = new Set<ScreenshotErrorCode>([
  "dns_error",
  "invalid_arguments",
  "invalid_target",
  "invalid_url",
  // A capture that exceeds the size limit will do so again on every attempt.
  "output_too_large",
  "target_blocked",
  "tls_error",
]);

const PERMANENT_CONFIGURATION_CODES = new Set<ScreenshotErrorCode>(["configuration_error"]);

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
  if (!(error instanceof ScreenshotError)) return "retryable_infrastructure";
  if (PERMANENT_CONFIGURATION_CODES.has(error.code)) return "permanent_configuration";
  return PERMANENT_TARGET_CODES.has(error.code) ? "permanent_target" : "retryable_infrastructure";
}

export function getScreenshotErrorCode(error: unknown): ScreenshotErrorCode {
  return error instanceof ScreenshotError ? error.code : "sandbox_control_plane";
}

export function getScreenshotErrorContext(error: unknown): ScreenshotErrorContext | undefined {
  return error instanceof ScreenshotError ? error.context : undefined;
}
