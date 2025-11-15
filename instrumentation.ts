import { registerOTel } from "@vercel/otel";
import type { Instrumentation } from "next";

export const register = () => {
  registerOTel({ serviceName: "domainstack" });
};

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
) => {
  // Only track errors in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      // Dynamic imports for Node.js-only code
      const { analytics } = await import("@/lib/analytics/server");

      // Note: we let analytics.trackException handle distinctId extraction from cookies
      analytics.trackException(
        error instanceof Error ? error : new Error(String(error)),
        {
          path: request.path,
          method: request.method,
        },
      );
    } catch (trackingError) {
      // Graceful degradation - don't throw to avoid breaking the request
      console.error("[instrumentation] error tracking failed:", trackingError);
    }
  }
};
