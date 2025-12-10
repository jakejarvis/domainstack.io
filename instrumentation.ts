import { logs } from "@opentelemetry/api-logs";
import {
  ConsoleLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { registerOTel } from "@vercel/otel";
import type { Instrumentation } from "next";

export const register = () => {
  // Traces/spans (existing)
  registerOTel({ serviceName: "domainstack" });

  // Logs - Setup OpenTelemetry LoggerProvider with console exporter
  // Vercel captures console output, so this provides automatic trace correlation
  // while maintaining compatibility with Vercel's log aggregation.
  // Can be swapped for OTLPLogExporter to send to external backends.
  const loggerProvider = new LoggerProvider({
    processors: [new SimpleLogRecordProcessor(new ConsoleLogRecordExporter())],
  });

  logs.setGlobalLoggerProvider(loggerProvider);
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
