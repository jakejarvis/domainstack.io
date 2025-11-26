/**
 * OpenTelemetry tracing utilities for automatic span creation.
 *
 * Provides helpers to wrap service functions with automatic tracing,
 * reducing boilerplate while maintaining full observability.
 */

import { type Attributes, context, type Span, trace } from "@opentelemetry/api";

// ============================================================================
// Types
// ============================================================================

export type SpanOptions = {
  /** Name of the span (e.g., 'dns.getDnsRecords') */
  name: string;
  /** Additional attributes to attach to the span */
  attributes?: Attributes;
};

export type DynamicSpanOptions<TArgs extends unknown[]> = (
  args: TArgs,
) => SpanOptions;

// ============================================================================
// Span Helpers
// ============================================================================

/**
 * Wraps an async service function with automatic OpenTelemetry span creation.
 *
 * Features:
 * - Automatic span lifecycle management (start/end)
 * - Exception recording with proper error status
 * - Optional dynamic attributes based on function arguments
 * - Result metadata extraction (e.g., array length)
 *
 * @example Static span name and attributes
 * ```typescript
 * export const getConfig = withSpan(
 *   { name: 'config.get', attributes: { 'config.type': 'global' } },
 *   async () => {
 *     return await fetchConfig();
 *   }
 * );
 * ```
 *
 * @example Dynamic attributes from function arguments
 * ```typescript
 * export const getDnsRecords = withSpan(
 *   ([domain]) => ({
 *     name: 'dns.getDnsRecords',
 *     attributes: { 'dns.domain': domain }
 *   }),
 *   async (domain: string) => {
 *     return await lookupDns(domain);
 *   }
 * );
 * ```
 */
export function withSpan<TArgs extends unknown[], TReturn>(
  options: SpanOptions | DynamicSpanOptions<TArgs>,
  fn: (...args: TArgs) => Promise<TReturn>,
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    // Determine span options (static or dynamic based on args)
    const spanOptions = typeof options === "function" ? options(args) : options;

    const tracer = trace.getTracer("service-layer");
    const span = tracer.startSpan(spanOptions.name, {
      attributes: spanOptions.attributes,
    });

    try {
      // Execute the wrapped function
      const result = await fn(...args);

      // Add result metadata if available
      addResultMetadata(span, result);

      return result;
    } catch (error) {
      // Record exception and set error status
      span.recordException(error as Error);
      span.setStatus({
        code: 2, // ERROR (SpanStatusCode.ERROR)
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      span.end();
    }
  };
}

/**
 * Wraps a synchronous service function with automatic span creation.
 *
 * Use this for CPU-bound operations or synchronous transforms that
 * you want to measure independently.
 *
 * @example
 * ```typescript
 * export const parseConfig = withSpanSync(
 *   { name: 'config.parse' },
 *   (raw: string) => {
 *     return JSON.parse(raw);
 *   }
 * );
 * ```
 */
export function withSpanSync<TArgs extends unknown[], TReturn>(
  options: SpanOptions | DynamicSpanOptions<TArgs>,
  fn: (...args: TArgs) => TReturn,
): (...args: TArgs) => TReturn {
  return (...args: TArgs): TReturn => {
    const spanOptions = typeof options === "function" ? options(args) : options;

    const tracer = trace.getTracer("service-layer");
    const span = tracer.startSpan(spanOptions.name, {
      attributes: spanOptions.attributes,
    });

    try {
      const result = fn(...args);
      addResultMetadata(span, result);
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: 2, // ERROR
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      span.end();
    }
  };
}

/**
 * Create a child span for a scoped operation within an already traced function.
 *
 * Useful for breaking down a complex operation into multiple instrumented steps
 * without needing to extract separate functions.
 *
 * @example
 * ```typescript
 * async function complexOperation(domain: string) {
 *   const dns = await withChildSpan(
 *     { name: 'dns.lookup', attributes: { domain } },
 *     () => lookupDns(domain)
 *   );
 *
 *   const cert = await withChildSpan(
 *     { name: 'cert.check', attributes: { domain } },
 *     () => checkCert(domain)
 *   );
 *
 *   return { dns, cert };
 * }
 * ```
 */
export async function withChildSpan<T>(
  options: SpanOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer("service-layer");
  const span = tracer.startSpan(options.name, {
    attributes: options.attributes,
  });

  try {
    const result = await fn();
    addResultMetadata(span, result);
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({
      code: 2,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Synchronous version of withChildSpan.
 */
export function withChildSpanSync<T>(options: SpanOptions, fn: () => T): T {
  const tracer = trace.getTracer("service-layer");
  const span = tracer.startSpan(options.name, {
    attributes: options.attributes,
  });

  try {
    const result = fn();
    addResultMetadata(span, result);
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({
      code: 2,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Get the current active span (if any).
 * Useful for adding custom attributes to the current span.
 *
 * @example
 * ```typescript
 * const span = getCurrentSpan();
 * if (span) {
 *   span.setAttribute('custom.metric', value);
 * }
 * ```
 */
export function getCurrentSpan(): Span | undefined {
  return trace.getSpan(context.active());
}

/**
 * Add a custom attribute to the current span (if any).
 *
 * @example
 * ```typescript
 * addSpanAttribute('cache.hit', true);
 * addSpanAttribute('db.query.duration_ms', 123);
 * ```
 */
export function addSpanAttribute(key: string, value: unknown): void {
  const span = getCurrentSpan();
  if (span && isValidAttributeValue(value)) {
    span.setAttribute(key, value);
  }
}

/**
 * Add multiple attributes to the current span (if any).
 */
export function addSpanAttributes(attributes: Record<string, unknown>): void {
  const span = getCurrentSpan();
  if (span) {
    for (const [key, value] of Object.entries(attributes)) {
      if (isValidAttributeValue(value)) {
        span.setAttribute(key, value);
      }
    }
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Extract and add metadata from the result to the span.
 * Adds common patterns like array length, object properties, etc.
 */
function addResultMetadata(span: Span, result: unknown): void {
  if (!result) return;

  // Array length
  if (Array.isArray(result)) {
    span.setAttribute("result.count", result.length);
    return;
  }

  // Object with length property (array-like)
  if (
    typeof result === "object" &&
    "length" in result &&
    typeof result.length === "number"
  ) {
    span.setAttribute("result.count", result.length);
    return;
  }

  // Object with count property
  if (
    typeof result === "object" &&
    "count" in result &&
    typeof result.count === "number"
  ) {
    span.setAttribute("result.count", result.count);
  }
}

/**
 * Check if a value is a valid OpenTelemetry attribute value.
 * Valid types: string, number, boolean, or arrays of these types.
 */
function isValidAttributeValue(
  value: unknown,
): value is string | number | boolean | string[] | number[] | boolean[] {
  if (value === null || value === undefined) return false;

  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean") {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(
      (item) =>
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean",
    );
  }

  return false;
}
