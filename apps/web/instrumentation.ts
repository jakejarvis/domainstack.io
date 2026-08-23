import type { Instrumentation } from "next";

export async function register() {
  // Initialize Vercel Workflow world for durable backend operations
  // Only runs in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME !== "edge") {
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

  try {
    const { logger } = await import("@domainstack/logger");
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
    // Don't throw from instrumentation
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
};
