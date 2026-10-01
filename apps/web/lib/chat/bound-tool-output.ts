export const TOOL_OUTPUT_LIMITS = { maxString: 1_000, maxArray: 100, maxDepth: 8 } as const;
export const TRUNCATION_MARKER = "… [truncated]";

interface Limits {
  readonly maxString: number;
  readonly maxArray: number;
  readonly maxDepth: number;
}

/**
 * Bound a lookup result before it reaches a model or an MCP client. Domain data is
 * written by whoever controls the domain, so its size is attacker-chosen. Strings
 * are cut with a visible marker; arrays keep their first `maxArray` items; nesting
 * past `maxDepth` is replaced with the marker. Shape is otherwise unchanged.
 */
export function boundToolOutput<T>(value: T, limits: Limits = TOOL_OUTPUT_LIMITS): T {
  return bound(value, limits, 0) as T;
}

function bound(value: unknown, limits: Limits, depth: number): unknown {
  if (typeof value === "string") {
    return value.length > limits.maxString
      ? value.slice(0, limits.maxString) + TRUNCATION_MARKER
      : value;
  }
  if (value === null || typeof value !== "object" || value instanceof Date) {
    return value;
  }
  if (depth >= limits.maxDepth) {
    return TRUNCATION_MARKER;
  }
  if (Array.isArray(value)) {
    return value.slice(0, limits.maxArray).map((item) => bound(item, limits, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = bound(item, limits, depth + 1);
  }
  return out;
}
