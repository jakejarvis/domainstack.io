import { createHmac } from "node:crypto";

/**
 * Simple hash function for strings.
 */
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Deterministic, obfuscated hash for IDs and filenames.
 */
export function deterministicHash(
  input: string,
  secret: string,
  length = 32,
): string {
  return createHmac("sha256", secret)
    .update(input)
    .digest("hex")
    .slice(0, length);
}
