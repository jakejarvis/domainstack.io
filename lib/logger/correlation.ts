import { v4 as uuidv4 } from "uuid";

/**
 * Correlation ID utilities for request tracing.
 *
 * Correlation IDs allow tracking a request across multiple services and layers.
 * Uses Vercel's x-vercel-id header when available, falling back to generated IDs.
 */

/**
 * Generate a new correlation ID (UUID v4).
 */
export function generateCorrelationId(): string {
  return uuidv4();
}

/**
 * Extract correlation ID from Vercel's x-vercel-id header or generate a new one.
 *
 * Vercel ID format: "region::deployment::request" (e.g., "iad1::sfo1::t7rxz-1765254901726-32fbe3710d68")
 * We extract the last part (request ID) after the last "::".
 *
 * Server-side only.
 */
export function getOrGenerateCorrelationId(headers: Headers): string {
  const vercelId = headers.get("x-vercel-id");

  if (vercelId) {
    // Extract the request ID (last part after final "::")
    const lastIndex = vercelId.lastIndexOf("::");
    if (lastIndex !== -1 && lastIndex < vercelId.length - 2) {
      const requestId = vercelId.substring(lastIndex + 2);
      if (requestId) {
        return requestId;
      }
    }
  }

  // Fallback: Generate new ID
  return generateCorrelationId();
}
