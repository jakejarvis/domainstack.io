/** 32-bit FNV-1a, base36: a short stable key that works in browser and Node alike. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (const char of input) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Convert a string to a slug (kebab-case).
 * Handles diacritics by normalizing to NFD and stripping combining marks.
 * When letters or digits outside a-z/0-9 are dropped (CJK, Cyrillic, ß, …), a stable
 * hash of the full name is appended so distinct names keep distinct slugs.
 *
 * @example
 * slugify("café") // "cafe"
 * slugify("München") // "munchen"
 * slugify("Hello World!") // "hello-world"
 * slugify("北京新网") // "u-…"
 */
export function slugify(input: string): string {
  const base = input
    .normalize("NFD") // Decompose diacritics (e.g., "é" -> "e" + combining accent)
    .replace(/[\u0300-\u036f]/g, "") // Strip combining diacritical marks
    .trim()
    .toLowerCase();
  const slug = base.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

  // Letters or digits outside a–z/0–9 (CJK, Cyrillic, ß, …) were dropped above, so two
  // different names could share a slug, or both get "". Key on the full name instead.
  const dropped = /[\p{L}\p{N}]/u.test(base.replace(/[a-z0-9]/g, ""));
  if (!dropped) return slug;

  const hash = fnv1a(input.normalize("NFKC").trim().toLowerCase());
  return slug ? `${slug}-${hash}` : `u-${hash}`;
}
