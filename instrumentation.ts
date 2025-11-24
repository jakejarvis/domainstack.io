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
