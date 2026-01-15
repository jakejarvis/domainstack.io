import type { Header } from "@/lib/types/domain/headers";

/**
 * Normalize header names (trim + lowercase).
 */
export function normalizeHeaders(h: Header[]): Header[] {
  return h.map((hdr) => ({
    name: hdr.name.trim().toLowerCase(),
    value: hdr.value,
  }));
}

/**
 * Get the human-readable message for an HTTP status code.
 * Returns undefined if the status code is unknown.
 */
export async function getHttpStatusMessage(
  statusCode: number,
): Promise<string | undefined> {
  try {
    const { getStatusCode } = await import("@readme/http-status-codes");
    const statusInfo = getStatusCode(statusCode);
    return statusInfo.message;
  } catch {
    return undefined;
  }
}
