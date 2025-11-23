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

export const CORRELATION_ID_HEADER = "x-correlation-id";
export const CORRELATION_ID_COOKIE = "x-correlation-id";
export const CORRELATION_ID_STORAGE_KEY = "correlationId";

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
 * Get correlation ID from localStorage (client-side only).
 * Returns undefined if not available or if running server-side.
 */
export function getCorrelationIdFromStorage(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return localStorage.getItem(CORRELATION_ID_STORAGE_KEY) || undefined;
  } catch {
    // localStorage not available or blocked
    return undefined;
  }
}

/**
 * Store correlation ID in localStorage (client-side only).
 */
export function setCorrelationIdInStorage(id: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(CORRELATION_ID_STORAGE_KEY, id);
  } catch {
    // localStorage not available or blocked - gracefully ignore
  }
}

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
 * Priority: cookie > localStorage > generate new
 */
export function getOrGenerateClientCorrelationId(): string {
  // Try cookie first (set by server)
  const fromCookie = getCorrelationIdFromCookie();
  if (fromCookie) {
    // Store in localStorage for persistence
    setCorrelationIdInStorage(fromCookie);
    return fromCookie;
  }

  // Try localStorage
  const fromStorage = getCorrelationIdFromStorage();
  if (fromStorage) {
    return fromStorage;
  }

  // Generate new and store
  const newId = generateCorrelationId();
  setCorrelationIdInStorage(newId);
  return newId;
}
