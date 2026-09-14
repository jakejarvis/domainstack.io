/**
 * SEO module for HTML meta parsing and robots.txt handling.
 *
 * Provides utilities for extracting SEO metadata from HTML pages
 * and parsing robots.txt files.
 */

// HTML meta parsing
export { extractMetaTagValues, parseHtmlMeta, selectPreview } from "./parse";
export type { ParseRobotsTxtOptions } from "./robots";
// Robots.txt parsing
export { parseRobotsTxt } from "./robots";

// Utility functions
export { resolveUrlMaybe, sanitizeText } from "./utils";
