/**
 * Simple, fast, deterministic hash for strings.
 *
 * Notes:
 * - This is **not** cryptographically secure.
 * - It is intended only for lightweight bucketing / stable ordering (e.g. colors, provider order).
 */
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    // Coerce to signed 32-bit integer (JS bitwise ops operate on int32).
    hash |= 0;
  }
  return Math.abs(hash);
}
