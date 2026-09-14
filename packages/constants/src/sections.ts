/**
 * Domain report section ids.
 *
 * The full set of report sections, in the order the report renders them. UI
 * metadata (titles, icons, accents) lives in apps/web, which imports this list
 * instead of retyping it.
 */
export const SECTION_IDS = [
  "registration",
  "hosting",
  "dns",
  "certificates",
  "headers",
  "seo",
] as const;

export type Section = (typeof SECTION_IDS)[number];
