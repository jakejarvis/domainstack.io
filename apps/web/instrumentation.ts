import type { Instrumentation } from "next";

import { isFrameworkRequestError } from "@/lib/analytics/ignored-request-errors";

export async function register() {
  // Only runs in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME !== "edge") {
    // Flush buffered OTLP logs at request boundaries. Registering here means
    // every request scope (route handlers, Server Components, Server Actions)
    // is covered without each one opting in.
    const { after } = await import("next/server");
    const { setFlushScheduler } = await import("@domainstack/logger");
    setFlushScheduler((task) => after(task));

    // Initialize Vercel Workflow world for durable backend operations
    const { getWorld } = await import("workflow/runtime");
    const world = await getWorld();
    await world.start?.();
  }
}

/**
 * Handle uncaught errors in Next.js requests.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { after } = await import("next/server");

  after(async () => {
    try {
      const { flushLogs, logger } = await import("@domainstack/logger");
      logger.error(
        {
          err: error,
          source: "instrumentation",
          path: request.path,
          method: request.method,
        },
        "request error",
      );
      await flushLogs();
    } catch {
      // Don't throw from instrumentation
    }

    // Framework-level rejections (for example the Server Actions CSRF guard) are
    // not application bugs. Log them for context, but keep them out of error
    // tracking so scanner probes do not open issues.
    if (isFrameworkRequestError(error)) {
      return;
    }

    try {
      const { captureException } = await import("@/lib/analytics/server");
      const captured =
        error instanceof Error
          ? error
          : new Error(typeof error === "string" ? error : "Request error");
      await captureException(captured, undefined, {
        path: request.path,
        method: request.method,
      });
    } catch {
      // Analytics must never break the request
    }
  });
};
