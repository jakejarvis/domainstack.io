/**
 * Human-readable HTTP status reason phrases.
 */

import { getStatusCode } from "@readme/http-status-codes";

/**
 * Get the reason phrase for an HTTP status code (e.g. 400 → "Bad Request").
 * Returns undefined if the status code is unknown.
 */
export function getHttpStatusMessage(statusCode: number): string | undefined {
  try {
    return getStatusCode(statusCode).message;
  } catch {
    return undefined;
  }
}
