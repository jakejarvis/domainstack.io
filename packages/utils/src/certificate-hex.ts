/**
 * Normalize a certificate fingerprint or serial for stable comparison.
 *
 * Strips colons and lowercases so `A1:B2:C3` and `a1b2c3` compare equal.
 * Returns null for missing or empty values.
 */
export function normalizeCertificateHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/:/g, "").toLowerCase();
  return normalized.length > 0 ? normalized : null;
}
