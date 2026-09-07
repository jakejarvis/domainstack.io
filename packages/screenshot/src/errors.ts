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

export type ScreenshotErrorClassification = "permanent_target" | "retryable_infrastructure";

export interface ScreenshotErrorContext {
  sandboxId: string | null;
  durationMs: number;
  exitCode: number | null;
  cleanupSucceeded: boolean;
}

const PERMANENT_TARGET_CODES = new Set<ScreenshotErrorCode>([
  "dns_error",
  "invalid_arguments",
  "invalid_target",
  "invalid_url",
  "target_blocked",
  "tls_error",
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
  return error instanceof ScreenshotError && PERMANENT_TARGET_CODES.has(error.code)
    ? "permanent_target"
    : "retryable_infrastructure";
}

export function getScreenshotErrorCode(error: unknown): ScreenshotErrorCode {
  return error instanceof ScreenshotError ? error.code : "sandbox_control_plane";
}

export function getScreenshotErrorContext(error: unknown): ScreenshotErrorContext | undefined {
  return error instanceof ScreenshotError ? error.context : undefined;
}
