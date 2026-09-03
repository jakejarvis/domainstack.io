import { SeverityNumber } from "@opentelemetry/api-logs";
import type { LogRecord } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";

const RESERVED_KEYS = new Set(["level", "time", "msg"]);

const PINO_LABEL_TO_SEVERITY: Record<string, SeverityNumber> = {
  trace: SeverityNumber.TRACE,
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
  fatal: SeverityNumber.FATAL,
};

const PINO_NUMERIC_TO_SEVERITY: Record<number, SeverityNumber> = {
  10: SeverityNumber.TRACE,
  20: SeverityNumber.DEBUG,
  30: SeverityNumber.INFO,
  40: SeverityNumber.WARN,
  50: SeverityNumber.ERROR,
  60: SeverityNumber.FATAL,
};

let provider: LoggerProvider | undefined;

/**
 * Schedules work to run after the current request completes. Hosts provide
 * their own primitive (Next.js supplies `after()`) so this package stays
 * framework-agnostic.
 */
export type FlushScheduler = (task: () => Promise<void>) => void;

let scheduleFlush: FlushScheduler | undefined;
let flushScheduled = false;

/**
 * Register the scheduler used to flush buffered records at request boundaries.
 * Call once during server startup; until then, records are only exported when
 * the batch processor's own timer fires or `flushLogs` is called directly.
 */
export function setFlushScheduler(scheduler: FlushScheduler): void {
  scheduleFlush = scheduler;
}

/**
 * Queue a flush for the end of the current request, at most one at a time.
 *
 * The flag resets when the task starts rather than when it finishes, so
 * records emitted while an export is in flight schedule a fresh flush instead
 * of being stranded in the buffer.
 */
function ensureFlushScheduled(): void {
  if (!scheduleFlush || flushScheduled) {
    return;
  }

  flushScheduled = true;
  try {
    scheduleFlush(async () => {
      flushScheduled = false;
      await flushLogs();
    });
  } catch {
    // No active request scope (workflow step, script, module init)
    flushScheduled = false;
  }
}

function isExportEnabled(): boolean {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return false;
  }
  return process.env.NODE_ENV === "production";
}

function toSeverity(level: unknown): SeverityNumber {
  if (typeof level === "string") {
    return PINO_LABEL_TO_SEVERITY[level] ?? SeverityNumber.UNSPECIFIED;
  }
  if (typeof level === "number") {
    return PINO_NUMERIC_TO_SEVERITY[level] ?? SeverityNumber.UNSPECIFIED;
  }
  return SeverityNumber.UNSPECIFIED;
}

function toTimestamp(time: unknown): number | undefined {
  if (typeof time === "number" && Number.isFinite(time)) {
    return time;
  }
  if (typeof time === "string") {
    const parsed = Date.parse(time);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function toAttributeValue(value: unknown): string | number | boolean {
  if (isScalar(value)) {
    return value;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function toAttributes(record: Record<string, unknown>): Record<string, string | number | boolean> {
  const attributes: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(record)) {
    if (RESERVED_KEYS.has(key) || value === null || value === undefined) {
      continue;
    }

    if (isScalar(value)) {
      attributes[key] = value;
      continue;
    }

    if (typeof value === "object" && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        if (nestedValue === null || nestedValue === undefined) {
          continue;
        }
        attributes[`${key}.${nestedKey}`] = toAttributeValue(nestedValue);
      }
      continue;
    }

    attributes[key] = toAttributeValue(value);
  }

  return attributes;
}

/**
 * Maps a parsed Pino JSON record to an OpenTelemetry log record.
 */
export function toLogRecord(record: Record<string, unknown>): LogRecord {
  const timestamp = toTimestamp(record.time);
  const body = typeof record.msg === "string" ? record.msg : "";

  return {
    body,
    severityNumber: toSeverity(record.level),
    ...(timestamp !== undefined ? { timestamp } : {}),
    attributes: toAttributes(record),
  };
}

function getProvider(): LoggerProvider | undefined {
  if (provider) {
    return provider;
  }
  if (!isExportEnabled()) {
    return undefined;
  }

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    return undefined;
  }

  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(
    /\/$/,
    "",
  );

  const resourceAttributes: Record<string, string> = {
    "service.name": "domainstack-web",
  };
  if (process.env.VERCEL_ENV) {
    resourceAttributes["deployment.environment"] = process.env.VERCEL_ENV;
  }
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    resourceAttributes["service.version"] = process.env.VERCEL_GIT_COMMIT_SHA;
  }

  provider = new LoggerProvider({
    resource: resourceFromAttributes(resourceAttributes),
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: `${host}/i/v1/logs`,
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
        }),
      }),
    ],
  });

  return provider;
}

/**
 * Convert a parsed Pino record and emit it to PostHog via OTLP.
 * No-ops when export is disabled (tests, local dev).
 */
export function emitToPostHog(record: Record<string, unknown>): void {
  if (!isExportEnabled()) {
    return;
  }

  try {
    const current = getProvider();
    if (!current) {
      return;
    }
    current.getLogger("domainstack").emit(toLogRecord(record));
    ensureFlushScheduled();
  } catch {
    // Logging must never throw
  }
}

/**
 * Flush buffered OTLP log records. Normally driven by the registered
 * `FlushScheduler`; call directly from contexts that have no request scope
 * so serverless functions do not freeze before the batch export completes.
 */
export async function flushLogs(): Promise<void> {
  if (!provider) {
    return;
  }
  try {
    await provider.forceFlush();
  } catch {
    // Flush must never throw at request boundaries
  }
}
