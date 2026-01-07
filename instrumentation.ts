import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { registerOTel } from "@vercel/otel";
import type { Instrumentation } from "next";

export async function register() {
  registerOTel({
    serviceName: "domainstack",
    instrumentations: [
      "auto", // Keep Vercel's default fetch instrumentation
      new PinoInstrumentation(),
    ],
  });

  // Initialize Vercel Workflow world for durable backend operations
  // Only runs in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME !== "edge") {
    const { getWorld } = await import("workflow/runtime");
    await getWorld().start?.();
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
      logger.error(
        {
          err: error,
          source: "instrumentation",
          path: request.path,
          method: request.method,
        },
        "request error",
      );
    } catch {
      // Graceful degradation - don't throw to avoid breaking the request
    }
  }
};
