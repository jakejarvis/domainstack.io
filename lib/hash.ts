import { createHmac } from "node:crypto";

/**
 * Deterministic, obfuscated hash for IDs and filenames.
 *
 * Notes:
 * - Uses HMAC-SHA256.
 * - Output is hex, safe for URLs/filenames.
 * - `length` is clamped to the valid SHA-256 hex range: 0..64.
 */
export function deterministicHash(
  input: string,
  secret: string,
  length = 32,
): string {
  const safeLength = normalizeSha256HexLength(length);
  return createHmac("sha256", secret)
    .update(input)
    .digest("hex")
    .slice(0, safeLength);
}

const SHA256_HEX_LENGTH = 64;

function normalizeSha256HexLength(length: number): number {
  if (!Number.isFinite(length)) return 32;
  return Math.max(0, Math.min(SHA256_HEX_LENGTH, Math.trunc(length)));
}
