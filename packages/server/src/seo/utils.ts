/**
 * SEO utility functions for text sanitization and URL resolution.
 */

/**
 * Sanitize text by removing control characters, collapsing whitespace,
 * and stripping invisible formatting characters.
 */
export function sanitizeText(input: unknown): string {
  let out = String(input ?? "");
  out = out.trim().replace(/\s+/g, " ");
  let res = "";
  for (let i = 0; i < out.length; i++) {
    const code = out.charCodeAt(i);
    if (
      (code >= 0 && code <= 8) ||
      (code >= 11 && code <= 12) ||
      (code >= 14 && code <= 31) ||
      code === 127
    ) {
      continue;
    }
    res += out[i] as string;
  }
  // Strip invisible formatting chars (ZWSP, bidi marks, BOM)
  return res.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "");
}

/**
 * Resolve a URL against a base URL, returning null for invalid or non-HTTP(S) URLs.
 */
export function resolveUrlMaybe(
  value: string | undefined,
  baseUrl: string,
): string | null {
  if (!value) return null;
  try {
    const u = new URL(value, baseUrl);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    return null;
  } catch {
    return null;
  }
}
