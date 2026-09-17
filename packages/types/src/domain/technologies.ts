/**
 * Technology detection types - Plain TypeScript interfaces.
 */

import type { TECHNOLOGY_CATEGORIES, TECHNOLOGY_SIGNALS } from "@domainstack/constants";

export type TechnologyCategory = (typeof TECHNOLOGY_CATEGORIES)[number];
export type TechnologySignal = (typeof TECHNOLOGY_SIGNALS)[number];

/**
 * One technology detected on a site.
 */
export interface DetectedTechnology {
  /** Stable catalog key, kebab-case. Never changes once shipped. */
  slug: string;
  name: string;
  categories: TechnologyCategory[];
  /** Project or vendor homepage. */
  website: string;
  /** Registrable domain of `website`, used to render the icon. */
  iconDomain: string | null;
  /** Captured from the matching pattern, when the pattern captures one. */
  version: string | null;
  /** True when this was not matched directly but pulled in by another entry's `implies`. */
  implied: boolean;
  /** Which signal kinds produced the match. Empty for implied entries. */
  detectedBy: TechnologySignal[];
}

/**
 * Response from technology detection.
 */
export interface TechnologiesResponse {
  technologies: DetectedTechnology[];
  source: {
    finalUrl: string | null;
    status: number | null;
  };
  /** Set when the page could not be analyzed (DNS/TLS/HTTP/non-HTML). */
  error?: string;
}
