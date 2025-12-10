import type { Instrumentation } from "next";

/**
 * Next.js instrumentation entry point.
 *
 * This file is loaded once when the Next.js server starts.
 * We use it to initialize OpenTelemetry for tracing and structured logging.
 *
 * @see https://nextjs.org/docs/app/guides/open-telemetry
 * @see instrumentation.node.ts for the OpenTelemetry SDK configuration
 */
export async function register() {
  // Only initialize OpenTelemetry in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Dynamic import to avoid loading Node.js-specific code in Edge runtime
    // The SDK starts automatically on import
    await import("./instrumentation.node");
  }
}

/**
 * Handle uncaught errors in Next.js requests.
 * Logs errors with full context for debugging.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
) => {
  // Only track errors in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      // Use logger for structured error logging
      const { logger } = await import("@/lib/logger/server");
      logger.error("request error", error, {
        source: "instrumentation",
        path: request.path,
        method: request.method,
      });
    } catch {
      // Graceful degradation - don't throw to avoid breaking the request
    }
  }
};
