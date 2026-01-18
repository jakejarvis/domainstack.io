/**
 * Utilities for normalizing registration data from RDAP/WHOIS.
 */

/**
 * Normalize a domain registration status to a canonical form for comparison.
 *
 * RDAP and WHOIS responses return EPP status codes in different formats:
 * - EPP camelCase: "clientTransferProhibited", "serverDeleteProhibited"
 * - Space-separated: "client transfer prohibited", "server delete prohibited"
 * - With underscores: "client_transfer_prohibited"
 *
 * This function normalizes all formats to lowercase without separators,
 * making "clientTransferProhibited" and "client transfer prohibited" equivalent.
 *
 * @param status - Raw status string from RDAP/WHOIS
 * @returns Normalized lowercase status string
 */
export function normalizeStatus(status: string): string {
  return status
    .toLowerCase()
    .replace(/[\s_-]+/g, "") // Remove spaces, underscores, hyphens
    .trim();
}

/**
 * Compare two arrays of status strings for semantic equality.
 *
 * Returns true if both arrays contain the same statuses after normalization,
 * regardless of order or formatting differences.
 *
 * @param previous - Previous status array
 * @param current - Current status array
 * @returns True if the status sets are semantically equal
 */
export function statusesAreEqual(
  previous: string[],
  current: string[],
): boolean {
  if (previous.length !== current.length) {
    return false;
  }

  const prevNormalized = [...previous].map(normalizeStatus).sort();
  const currNormalized = [...current].map(normalizeStatus).sort();

  return prevNormalized.every((status, i) => status === currNormalized[i]);
}
