import { logs } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import type { LogRecordProcessor } from "@opentelemetry/sdk-logs";
import { OTLPHttpProtoTraceExporter, registerOTel } from "@vercel/otel";
import type { Instrumentation } from "next";

const SERVICE_NAME = "domainstack-web";

/**
 * Drain buffered log records. `@vercel/otel` flushes spans itself via
 * `waitUntil` when the root span ends, but it leaves the logger provider to us,
 * so a serverless function can freeze with records still in the batch buffer.
 */
async function flushLogs(): Promise<void> {
  const provider = logs.getLoggerProvider();
  if (!("forceFlush" in provider) || typeof provider.forceFlush !== "function") {
    return;
  }

  try {
    await provider.forceFlush();
  } catch {
    // Flush must never throw at request boundaries
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    registerOTel({
      serviceName: SERVICE_NAME,
      instrumentationConfig: {
        fetch: { ignoreUrls: [/posthog\.com/i, /\/_proxy\/ingest/] },
      },
    });
    return;
  }

  const { after } = await import("next/server");

  let traceExporter: OTLPHttpProtoTraceExporter | undefined;
  let logRecordProcessors: LogRecordProcessor[] | undefined;

  // Export is production-only. Leaving both providers unregistered is what
  // makes every emit downstream a no-op everywhere else.
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (key && process.env.NODE_ENV === "production") {
    const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(
      /\/$/,
      "",
    );
    const headers = { Authorization: `Bearer ${key}` };

    traceExporter = new OTLPHttpProtoTraceExporter({
      url: `${host}/i/v1/traces`,
      headers,
    });

    logRecordProcessors = [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: `${host}/i/v1/logs`,
          headers: { ...headers, "Content-Type": "application/json" },
        }),
      }),
      {
        // Flush at the end of whichever request emitted the record. Several
        // records in one request each queue a flush; the first drains the
        // buffer and the rest resolve against an empty one.
        onEmit() {
          try {
            after(flushLogs);
          } catch {
            // No request scope (workflow step, script, module init). The batch
            // processor's own timer is the only remaining flush trigger.
          }
        },
        // Buffers nothing of its own.
        forceFlush: () => Promise.resolve(),
        shutdown: () => Promise.resolve(),
      },
    ];
  }

  // Configuring logs here rather than in @domainstack/logger keeps traces and
  // logs on one provider, so both carry the same resource attributes.
  registerOTel({
    serviceName: SERVICE_NAME,
    traceExporter,
    logRecordProcessors,
    instrumentationConfig: {
      fetch: { ignoreUrls: [/posthog\.com/i, /\/_proxy\/ingest/] },
    },
  });

  // Initialize Vercel Workflow world for durable backend operations
  const { getWorld } = await import("workflow/runtime");
  const world = await getWorld();
  await world.start?.();
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
    await captureException(error, undefined, {
      path: request.path,
      method: request.method,
    });
  } catch {
    // Analytics must never break the request
  }
};
