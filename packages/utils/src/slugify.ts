/**
 * Convert a string to a slug (kebab-case).
 * Handles diacritics by normalizing to NFD and stripping combining marks.
 *
 * @example
 * slugify("café") // "cafe"
 * slugify("München") // "munchen"
 * slugify("Hello World!") // "hello-world"
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD") // Decompose diacritics (e.g., "é" -> "e" + combining accent)
    .replace(/[\u0300-\u036f]/g, "") // Strip combining diacritical marks
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
