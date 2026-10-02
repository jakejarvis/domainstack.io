/**
 * Codes the runner may report on stdout. `@domainstack/screenshot` validates
 * incoming values against its own copy of this list, so the two must agree.
 */
export type RunnerErrorCode =
  | "browser_crash"
  | "capture_failed"
  | "connection_reset"
  | "dns_error"
  | "invalid_arguments"
  | "invalid_url"
  | "output_too_large"
  | "timeout"
  | "tls_error"
  | "upstream_temporary";

/**
 * Carries an explicit code so the runner's own failures are never re-derived by
 * matching on message text, which cannot distinguish them from Chromium's.
 */
export class RunnerError extends Error {
  readonly name = "RunnerError";

  constructor(
    readonly code: RunnerErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/**
 * Our own failures carry an explicit code; only Chromium's opaque errors are
 * matched on message text.
 */
export function classifyError(error: unknown): RunnerErrorCode {
  if (error instanceof RunnerError) return error.code;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("err_name_not_resolved") || message.includes("enotfound"))
    return "dns_error";
  if (
    message.includes("certificate") ||
    message.includes("ssl") ||
    message.includes("tls") ||
    message.includes("err_cert")
  ) {
    return "tls_error";
  }
  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("timed_out") ||
    message.includes("etimedout")
  ) {
    return "timeout";
  }
  if (
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("connection reset") ||
    message.includes("err_connection")
  ) {
    return "connection_reset";
  }
  if (
    message.includes("target closed") ||
    message.includes("browser has disconnected") ||
    message.includes("failed to launch the browser process")
  ) {
    return "browser_crash";
  }
  if (message.includes("429") || /\b5\d\d\b/.test(message)) return "upstream_temporary";
  return "capture_failed";
}
