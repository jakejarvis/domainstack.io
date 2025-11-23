"use client";

import { useMemo } from "react";
import { logger as clientLogger, createLogger } from "@/lib/logger/client";
import type { LogContext, Logger } from "@/lib/logger/index";

/**
 * React hook for component-level logging.
 *
 * Creates a memoized logger instance with component-specific context.
 * The logger automatically includes the correlation ID and any provided context.
 *
 * @param baseContext - Optional context to be included with all logs from this logger
 * @returns Logger instance
 *
 * @example
 * ```tsx
 * function DomainSearch() {
 *   const logger = useLogger({ component: "DomainSearch" });
 *
 *   const handleSearch = (query: string) => {
 *     logger.info("search_initiated", { query });
 *     // ... search logic
 *   };
 *
 *   return <input onChange={(e) => handleSearch(e.target.value)} />;
 * }
 * ```
 */
export function useLogger(baseContext?: LogContext): Logger {
  // Generate a stable key for the context to prevent logger recreation on every render
  // when using inline object literals (e.g. useLogger({ component: "..." })).
  // We use JSON.stringify as it handles the most common case of simple value objects.
  let contextKey: string | LogContext | undefined;
  try {
    contextKey = baseContext ? JSON.stringify(baseContext) : undefined;
  } catch {
    // Fallback to object reference if serialization fails (e.g. circular refs)
    contextKey = baseContext;
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: We use contextKey to control memoization, but we need baseContext for creation. Since equal keys imply equal content (for serializable objects), using the captured baseContext from the first render that produced this key is safe.
  return useMemo(() => {
    if (baseContext) {
      return createLogger(baseContext);
    }
    // Return singleton logger if no context provided
    return clientLogger;
  }, [contextKey]);
}
