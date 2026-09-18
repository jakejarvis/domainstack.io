/**
 * Technology detection constants and derived types.
 *
 * Categories a detected technology can belong to. Kept deliberately small:
 * every category must be one a report reader would recognize as a distinct
 * kind of thing, because the report groups detected technologies by category.
 */

export const TECHNOLOGY_CATEGORIES = [
  "cms",
  "ecommerce",
  "framework",
  "javascript-library",
  "web-server",
  "programming-language",
  "cdn",
  "hosting",
  "analytics",
  "tag-manager",
  "marketing",
  "payment",
  "security",
  "live-chat",
  "font-script",
  "error-tracking",
  "verification",
  "other",
] as const;

/**
 * Signal kinds a detection can come from. Reported per technology so the UI
 * and the JSON export can say *why* something was detected.
 *
 * `jsGlobal` is declared now and never produced by the static detector. A
 * later headless-browser probe fills `TechDetectionContext.js` and starts
 * producing it, with no schema or storage change.
 */
export const TECHNOLOGY_SIGNALS = [
  "header",
  "cookie",
  "meta",
  "html",
  "scriptSrc",
  "url",
  "dnsTxt",
  "jsGlobal",
] as const;
