import "server-only";

import pino from "pino";
import { getMinLogLevel, parseLogLevel } from "@/lib/logger";

/**
 * Cached Pino instance to prevent creating multiple instances during dev hot reload.
 * This avoids MaxListenersExceededWarning from pino-pretty's worker thread transport.
 */
let pinoSingleton: pino.Logger | null = null;

/**
 * Create and configure a Pino logger instance.
 *
 * - Development: Pretty-printed with colors via pino-pretty transport
 * - Production: Raw JSON to stdout for Vercel log aggregation
 * - Log level: Configurable via LOG_LEVEL env var or environment defaults
 * - Cached to prevent multiple instances during hot reload
 */
export function createPinoInstance(): pino.Logger {
  // Return cached instance if available (prevents hot reload issues)
  if (pinoSingleton) {
    return pinoSingleton;
  }

  // Base configuration
  const config: pino.LoggerOptions = {
    // Determine minimum log level (respects LOG_LEVEL env var override)
    level: parseLogLevel(process.env.LOG_LEVEL) || getMinLogLevel(),
    // Format level as string label (trace, debug, info, etc.) instead of numeric
    formatters: {
      level: (label) => ({ level: label }),
    },
  };

  // Add pino-pretty transport in development for human-readable output
  if (process.env.NODE_ENV === "development") {
    config.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        singleLine: false,
        ignore: "pid,hostname",
      },
    };
  }

  // Create and cache the instance
  pinoSingleton = pino(config);
  return pinoSingleton;
}

export type PinoLogger = pino.Logger;
