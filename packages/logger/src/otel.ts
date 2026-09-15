import { context } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import type { LogRecord } from "@opentelemetry/api-logs";
import pino from "pino";

import type { LogRecordValue, ParsedLogRecord } from "./index";

const RESERVED_KEYS = new Set(["level", "time", "msg"]);

/** The key `pino.stdSerializers.err` output lands on. Pino's `errorKey` default. */
const ERROR_KEY = "err";

/**
 * Maps the fields of a serialized Pino error onto OpenTelemetry's exception
 * attribute names, which is what error tracking reads.
 */
const EXCEPTION_ATTRIBUTES = {
  type: "exception.type",
  message: "exception.message",
  stack: "exception.stacktrace",
};

const PINO_LABEL_TO_SEVERITY = {
  trace: SeverityNumber.TRACE,
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
  fatal: SeverityNumber.FATAL,
};

const PINO_NUMERIC_TO_SEVERITY = {
  10: SeverityNumber.TRACE,
  20: SeverityNumber.DEBUG,
  30: SeverityNumber.INFO,
  40: SeverityNumber.WARN,
  50: SeverityNumber.ERROR,
  60: SeverityNumber.FATAL,
};

function toSeverity(level: LogRecordValue | undefined): SeverityNumber {
  if (typeof level === "string") {
    if (level in PINO_LABEL_TO_SEVERITY) {
      return PINO_LABEL_TO_SEVERITY[level as keyof typeof PINO_LABEL_TO_SEVERITY];
    }
    return SeverityNumber.UNSPECIFIED;
  }
  if (typeof level === "number") {
    return (
      PINO_NUMERIC_TO_SEVERITY[level as keyof typeof PINO_NUMERIC_TO_SEVERITY] ??
      SeverityNumber.UNSPECIFIED
    );
  }
  return SeverityNumber.UNSPECIFIED;
}

/** `formatters.level` emits labels, but stay readable if that ever changes. */
function toSeverityText(level: LogRecordValue | undefined): string | undefined {
  if (typeof level === "string") {
    return level;
  }
  if (typeof level === "number") {
    return pino.levels.labels[level];
  }
  return undefined;
}

function toTimestamp(time: LogRecordValue | undefined): number | undefined {
  if (typeof time === "number" && Number.isFinite(time)) {
    return time;
  }
  if (typeof time === "string") {
    const parsed = Date.parse(time);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function isScalar(value: LogRecordValue): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function toAttributeValue(value: LogRecordValue): string | number | boolean {
  if (isScalar(value)) {
    return value;
  }
  try {
    return JSON.stringify(value) ?? "[unserializable value]";
  } catch {
    return "[unserializable value]";
  }
}

function isPlainObject(value: LogRecordValue): value is ParsedLogRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Flattens nested objects one level deep with dotted keys. OTLP allows nested
 * maps, but flat scalar keys are what stays filterable downstream.
 */
function assignNested(
  attributes: Record<string, string | number | boolean>,
  prefix: string,
  value: ParsedLogRecord,
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

interface LogAttributes {
  [key: string]: string | number | boolean;
}

function toAttributes(record: ParsedLogRecord): LogAttributes {
  const attributes: LogAttributes = {};

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
export function toLogRecord(record: ParsedLogRecord): LogRecord {
  const timestamp = toTimestamp(record.time);
  const severityText = toSeverityText(record.level);

  const logRecord: LogRecord = {
    body: typeof record.msg === "string" ? record.msg : "",
    severityNumber: toSeverity(record.level),
    attributes: toAttributes(record),
    // Populates the record's own trace_id/span_id from the active span, which
    // is what log/trace correlation reads. Resolves to an invalid span context
    // outside a traced scope, and the SDK omits the fields.
    context: context.active(),
  };

  if (severityText !== undefined) logRecord.severityText = severityText;
  if (timestamp !== undefined) logRecord.timestamp = timestamp;

  return logRecord;
}

/**
 * Emit a parsed Pino record through the global OpenTelemetry logs API.
 *
 * No-ops until a provider is registered, so nothing is exported from local
 * runs, tests, or the edge runtime. The host owns provider setup, batching,
 * and flushing; see `apps/web/instrumentation.ts`.
 */
export function emitLogRecord(record: ParsedLogRecord): void {
  try {
    logs.getLogger("domainstack").emit(toLogRecord(record));
  } catch {
    // Logging must never throw
  }
}
