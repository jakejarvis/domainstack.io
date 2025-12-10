import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { registerOTel } from "@vercel/otel";
import type { Instrumentation } from "next";

export const register = () => {
  // Default: @vercel/otel outputs logs to console (Vercel captures automatically)
  // OTLP: Set OTEL_EXPORTER_OTLP_LOGS_ENDPOINT and OTEL_EXPORTER_OTLP_LOGS_HEADERS
  //       to send to any OTLP-compatible backend (PostHog, Grafana, Datadog, etc.)
  registerOTel({
    serviceName: "domainstack",
    ...(process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT && {
      logRecordProcessors: [new BatchLogRecordProcessor(new OTLPLogExporter())],
    }),
  });
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
