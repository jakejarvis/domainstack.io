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
  return useMemo(() => {
    if (baseContext) {
      return createLogger(baseContext);
    }
    // Return singleton logger if no context provided
    return clientLogger;
  }, [baseContext]);
}
