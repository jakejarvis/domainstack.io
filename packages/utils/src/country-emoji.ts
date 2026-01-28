/**
 * Convert a 2-letter ISO 3166-1 alpha-2 country code to its flag emoji.
 *
 * Each letter maps to a Unicode "Regional Indicator Symbol Letter":
 * - 'A' → U+1F1E6, 'B' → U+1F1E7, etc.
 * - "US" → 🇺🇸, "DE" → 🇩🇪, "JP" → 🇯🇵
 *
 * @param countryCode - 2-letter ISO country code (e.g., "US", "DE")
 * @returns Flag emoji string, or empty string if invalid
 */
export function countryCodeToEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "";

  const code = countryCode.toUpperCase();
  const OFFSET = 0x1f1e6 - "A".charCodeAt(0); // Regional Indicator 'A' - ASCII 'A'

  const first = code.charCodeAt(0);
  const second = code.charCodeAt(1);

  // Validate both characters are A-Z
  if (first < 65 || first > 90 || second < 65 || second > 90) return "";

  return String.fromCodePoint(first + OFFSET, second + OFFSET);
}
