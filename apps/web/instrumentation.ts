import type { Instrumentation } from "next";

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
