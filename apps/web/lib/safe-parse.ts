/**
 * Decode a URI component without throwing on malformed percent-escapes
 * (e.g. a lone `%` or `100%off`).
 */
export function safeDecodeURIComponent(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

/**
 * Parse an absolute URL without throwing on invalid input.
 */
export function safeUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}
