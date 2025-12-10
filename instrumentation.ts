import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import type { LogRecordProcessor } from "@opentelemetry/sdk-logs";
import {
  ConsoleLogRecordExporter,
  SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { registerOTel } from "@vercel/otel";
import type { Instrumentation } from "next";

export const register = () => {
  // Build log processors array
  // IMPORTANT: We must always provide at least one processor to ensure
  // @vercel/otel creates a LoggerProvider. Without this, logs.getLogger()
  // returns a no-op logger that silently discards all logs.
  const logRecordProcessors: LogRecordProcessor[] = [];

  // Console exporter for local development and Vercel dashboard visibility
  // Vercel captures console output automatically
  logRecordProcessors.push(
    new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()),
  );

  // OTLP exporter for external backends (PostHog, Grafana, Datadog, etc.)
  // Uses SimpleLogRecordProcessor for immediate export (critical for serverless)
  // BatchLogRecordProcessor buffers logs for 5s by default, which can cause
  // logs to be lost when serverless functions complete before the buffer flushes.
  //
  // Required env vars:
  //   OTEL_EXPORTER_OTLP_LOGS_ENDPOINT - Full URL including path (e.g., https://us.i.posthog.com/v1/logs)
  //   OTEL_EXPORTER_OTLP_LOGS_HEADERS  - Auth headers (e.g., authorization=Bearer <token>)
  if (process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT) {
    logRecordProcessors.push(
      new SimpleLogRecordProcessor(new OTLPLogExporter()),
    );
  }

  registerOTel({
    serviceName: "domainstack",
    logRecordProcessors,
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
