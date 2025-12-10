/**
 * Manual OpenTelemetry SDK initialization for Node.js runtime.
 *
 * This provides full control over tracing and logging configuration,
 * replacing the opinionated @vercel/otel wrapper.
 *
 * Features:
 * - Console output always enabled (Vercel captures stdout)
 * - OTLP export to external backends when configured (PostHog, Grafana, etc.)
 * - SimpleSpanProcessor/SimpleLogRecordProcessor for serverless (immediate export)
 * - Proper resource attributes for service identification
 *
 * Configuration (env vars):
 *   OTEL_EXPORTER_OTLP_ENDPOINT      - Base OTLP endpoint (e.g., https://us.i.posthog.com)
 *   OTEL_EXPORTER_OTLP_HEADERS       - Auth headers (e.g., authorization=Bearer <token>)
 *   OTEL_SERVICE_NAME                - Override service name (default: domainstack)
 *   OTEL_LOG_LEVEL                   - SDK debug logging (DEBUG, INFO, WARN, ERROR)
 *
 * PostHog example:
 *   OTEL_EXPORTER_OTLP_ENDPOINT=https://us.i.posthog.com
 *   OTEL_EXPORTER_OTLP_HEADERS=authorization=Bearer phx_YOUR_API_KEY
 */

import { DiagConsoleLogger, DiagLogLevel, diag } from "@opentelemetry/api";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ConsoleLogRecordExporter,
  SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

// ============================================================================
// Configuration
// ============================================================================

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || "domainstack";
const OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

// Enable SDK debug logging if OTEL_LOG_LEVEL is set
const LOG_LEVEL_MAP: Record<string, DiagLogLevel> = {
  ALL: DiagLogLevel.ALL,
  VERBOSE: DiagLogLevel.VERBOSE,
  DEBUG: DiagLogLevel.DEBUG,
  INFO: DiagLogLevel.INFO,
  WARN: DiagLogLevel.WARN,
  ERROR: DiagLogLevel.ERROR,
  NONE: DiagLogLevel.NONE,
};

if (process.env.OTEL_LOG_LEVEL) {
  const level =
    LOG_LEVEL_MAP[process.env.OTEL_LOG_LEVEL.toUpperCase()] ||
    DiagLogLevel.INFO;
  diag.setLogger(new DiagConsoleLogger(), level);
}

// ============================================================================
// Resource Configuration
// ============================================================================

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: SERVICE_NAME,
  [ATTR_SERVICE_VERSION]: process.env.npm_package_version || "0.0.0",
  // Vercel-specific attributes
  "vercel.env": process.env.VERCEL_ENV || process.env.NODE_ENV,
  "vercel.region": process.env.VERCEL_REGION,
  "vercel.runtime": process.env.NEXT_RUNTIME || "nodejs",
  "vercel.deployment_id": process.env.VERCEL_DEPLOYMENT_ID,
  "vercel.git_sha":
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
});

// ============================================================================
// Span Processors (Traces)
// ============================================================================

// Build span processors array
// Using SimpleSpanProcessor for immediate export (critical for serverless)
// BatchSpanProcessor buffers spans which can be lost when functions complete
const spanProcessors: SimpleSpanProcessor[] = [];

// Console exporter (always enabled for Vercel dashboard visibility)
// Only in development to avoid noise in production logs
if (process.env.NODE_ENV === "development") {
  spanProcessors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
}

// OTLP exporter for external backends
if (OTLP_ENDPOINT) {
  spanProcessors.push(
    new SimpleSpanProcessor(
      new OTLPTraceExporter({
        // The exporter will read OTEL_EXPORTER_OTLP_ENDPOINT and append /v1/traces
        // It also reads OTEL_EXPORTER_OTLP_HEADERS for authentication
      }),
    ),
  );
}

// ============================================================================
// Log Record Processors (Logs)
// ============================================================================

// Build log processors array
// IMPORTANT: We must always provide at least one processor to ensure
// a LoggerProvider is created. Without this, logs.getLogger() returns
// a no-op logger that silently discards all logs.
const logRecordProcessors: SimpleLogRecordProcessor[] = [];

// Console exporter (always enabled for Vercel dashboard visibility)
// Vercel captures console output automatically
logRecordProcessors.push(
  new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()),
);

// OTLP exporter for external backends
if (OTLP_ENDPOINT) {
  logRecordProcessors.push(
    new SimpleLogRecordProcessor(
      new OTLPLogExporter({
        // The exporter will read OTEL_EXPORTER_OTLP_ENDPOINT and append /v1/logs
        // It also reads OTEL_EXPORTER_OTLP_HEADERS for authentication
      }),
    ),
  );
}

// ============================================================================
// SDK Initialization
// ============================================================================

export const sdk = new NodeSDK({
  resource,
  // Span processors for traces
  spanProcessors,
  // Log record processors for structured logging
  logRecordProcessors,
  // Disable auto-instrumentation (we instrument manually via lib/tracing.ts)
  // This avoids duplicate spans and gives us more control
  instrumentations: [],
});

/**
 * Start the OpenTelemetry SDK.
 * Called from instrumentation.ts register() function.
 */
export function startOpenTelemetry(): void {
  sdk.start();

  // Log startup info (only visible if OTEL_LOG_LEVEL is set)
  diag.info("OpenTelemetry SDK started", {
    service: SERVICE_NAME,
    otlpEndpoint: OTLP_ENDPOINT || "(console only)",
    runtime: process.env.NEXT_RUNTIME || "nodejs",
    spanProcessors: spanProcessors.length,
    logProcessors: logRecordProcessors.length,
  });

  // Graceful shutdown on process exit
  const shutdown = async () => {
    try {
      await sdk.shutdown();
      diag.info("OpenTelemetry SDK shut down successfully");
    } catch (error) {
      diag.error("Error shutting down OpenTelemetry SDK", error);
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
