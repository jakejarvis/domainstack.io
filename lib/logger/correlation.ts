import { v4 as uuidv4 } from "uuid";

/**
 * Correlation ID utilities for request tracing.
 *
 * Correlation IDs allow tracking a request across multiple services and layers.
 * They are generated server-side and propagated to the client.
 */

// ============================================================================
// Constants
// ============================================================================

export const CORRELATION_ID_HEADER = "x-request-id";
export const CORRELATION_ID_COOKIE = "correlation-id";

// ============================================================================
// Generation
// ============================================================================

/**
 * Generate a new correlation ID (UUID v4).
 */
export function generateCorrelationId(): string {
  return uuidv4();
}

/**
 * Extract correlation ID from headers or generate a new one.
 * Server-side only.
 */
export function getOrGenerateCorrelationId(headers: Headers): string {
  const existing = headers.get(CORRELATION_ID_HEADER);
  return existing || generateCorrelationId();
}

// ============================================================================
// Client-side Storage
// ============================================================================

/**
 * Get correlation ID from cookie (client-side).
 * Returns undefined if not available.
 */
export function getCorrelationIdFromCookie(): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }

  try {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const trimmed = cookie.trim();
      const separatorIndex = trimmed.indexOf("=");

      if (separatorIndex === -1) {
        continue;
      }

      const name = trimmed.substring(0, separatorIndex);
      if (name === CORRELATION_ID_COOKIE) {
        const value = trimmed.substring(separatorIndex + 1);
        if (value) {
          return decodeURIComponent(value);
        }
      }
    }
  } catch {
    // Cookie parsing failed
  }

  return undefined;
}

/**
 * Get or generate correlation ID for client-side logging.
 * Reads from cookie (set by server middleware) or generates new if missing.
 */
export function getOrGenerateClientCorrelationId(): string {
  // Try cookie first (set by server middleware with 30-day expiry)
  const fromCookie = getCorrelationIdFromCookie();
  if (fromCookie) {
    return fromCookie;
  }

  // Fallback: Generate new ID if cookie is missing
  // (shouldn't happen in normal flow, but handles edge cases)
  return generateCorrelationId();
}
