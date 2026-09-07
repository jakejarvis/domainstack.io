import { context } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import type { LogRecord } from "@opentelemetry/api-logs";
import pino from "pino";

const RESERVED_KEYS = new Set(["level", "time", "msg"]);

/** The key `pino.stdSerializers.err` output lands on. Pino's `errorKey` default. */
const ERROR_KEY = "err";

/**
 * Maps the fields of a serialized Pino error onto OpenTelemetry's exception
 * attribute names, which is what error tracking reads.
 */
const EXCEPTION_ATTRIBUTES: Record<string, string> = {
  type: "exception.type",
  message: "exception.message",
  stack: "exception.stacktrace",
};

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

function toSeverity(level: unknown): SeverityNumber {
  if (typeof level === "string") {
    return PINO_LABEL_TO_SEVERITY[level] ?? SeverityNumber.UNSPECIFIED;
  }
  if (typeof level === "number") {
    return PINO_NUMERIC_TO_SEVERITY[level] ?? SeverityNumber.UNSPECIFIED;
  }
  return SeverityNumber.UNSPECIFIED;
}

/** `formatters.level` emits labels, but stay readable if that ever changes. */
function toSeverityText(level: unknown): string | undefined {
  if (typeof level === "string") {
    return level;
  }
  if (typeof level === "number") {
    return pino.levels.labels[level];
  }
  return undefined;
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Flattens nested objects one level deep with dotted keys. OTLP allows nested
 * maps, but flat scalar keys are what stays filterable downstream.
 */
function assignNested(
  attributes: Record<string, string | number | boolean>,
  prefix: string,
  value: Record<string, unknown>,
  keyMap?: Record<string, string>,
): void {
  for (const [nestedKey, nestedValue] of Object.entries(value)) {
    if (nestedValue === null || nestedValue === undefined) {
      continue;
    }
    const mapped = keyMap?.[nestedKey];
    attributes[mapped ?? `${prefix}.${nestedKey}`] = toAttributeValue(nestedValue);
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

    if (isPlainObject(value)) {
      assignNested(attributes, key, value, key === ERROR_KEY ? EXCEPTION_ATTRIBUTES : undefined);
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
  const severityText = toSeverityText(record.level);

  return {
    body: typeof record.msg === "string" ? record.msg : "",
    severityNumber: toSeverity(record.level),
    ...(severityText !== undefined ? { severityText } : {}),
    ...(timestamp !== undefined ? { timestamp } : {}),
    attributes: toAttributes(record),
    // Populates the record's own trace_id/span_id from the active span, which
    // is what log/trace correlation reads. Resolves to an invalid span context
    // outside a traced scope, and the SDK omits the fields.
    context: context.active(),
  };
}

/**
 * Emit a parsed Pino record through the global OpenTelemetry logs API.
 *
 * No-ops until a provider is registered, so nothing is exported from local
 * runs, tests, or the edge runtime. The host owns provider setup, batching,
 * and flushing; see `apps/web/instrumentation.ts`.
 */
export function emitLogRecord(record: Record<string, unknown>): void {
  try {
    logs.getLogger("domainstack").emit(toLogRecord(record));
  } catch {
    // Logging must never throw
  }
}
