import type { DetectedTechnology } from "@domainstack/types";
import { toRegistrableDomain } from "@domainstack/utils/domain";

import type { TechnologyCatalog, TechnologyEntry } from "./parser";
import type { TechDetectionContext } from "./rules";
import { evalTechRule } from "./rules";

function iconDomainFor(website: string): string | null {
  try {
    const hostname = new URL(website).hostname;
    return toRegistrableDomain(hostname);
  } catch {
    return null;
  }
}

interface DirectMatch {
  entry: TechnologyEntry;
  version: string | null;
  signals: DetectedTechnology["detectedBy"];
}

/**
 * Match the technology catalog against a detection context.
 *
 * Order: evaluate every entry's rule, apply `excludes`, resolve `implies`
 * transitively, derive `iconDomain`, then sort deterministically (direct
 * matches before implied, then by name).
 */
export function detectTechnologies(
  catalog: TechnologyCatalog,
  ctx: TechDetectionContext,
): DetectedTechnology[] {
  // 1. Evaluate every entry's rule, collect direct matches.
  const directMatches = new Map<string, DirectMatch>();
  for (const entry of catalog) {
    const result = evalTechRule(entry.rule, ctx);
    if (result.matched) {
      directMatches.set(entry.slug, { entry, version: result.version, signals: result.signals });
    }
  }

  // 2. Apply excludes: build the set of slugs excluded by any direct match.
  const excluded = new Set<string>();
  for (const { entry } of directMatches.values()) {
    for (const target of entry.excludes ?? []) {
      if (target !== entry.slug) excluded.add(target);
    }
  }
  for (const slug of excluded) {
    directMatches.delete(slug);
  }

  // 3. Resolve implies transitively, breadth-first, over surviving direct matches.
  const entriesBySlug = new Map(catalog.map((e) => [e.slug, e]));
  const resultSlugs = new Set(directMatches.keys());
  const impliedSlugs = new Set<string>();
  const queue: string[] = [...directMatches.keys()];
  const visited = new Set<string>(queue);

  while (queue.length > 0) {
    const slug = queue.shift();
    if (slug === undefined) break;
    const entry = entriesBySlug.get(slug);
    if (!entry) continue;
    for (const target of entry.implies ?? []) {
      if (visited.has(target)) continue;
      visited.add(target);
      if (excluded.has(target)) continue;
      if (!resultSlugs.has(target)) {
        resultSlugs.add(target);
        impliedSlugs.add(target);
      }
      queue.push(target);
    }
  }

  // 4 & assemble results.
  const results: DetectedTechnology[] = [];

  for (const [slug, match] of directMatches) {
    const { entry, version, signals } = match;
    results.push({
      slug,
      name: entry.name,
      categories: entry.categories,
      website: entry.website,
      iconDomain: iconDomainFor(entry.website),
      version,
      implied: false,
      detectedBy: signals,
    });
  }

  for (const slug of impliedSlugs) {
    const entry = entriesBySlug.get(slug);
    if (!entry) continue;
    results.push({
      slug,
      name: entry.name,
      categories: entry.categories,
      website: entry.website,
      iconDomain: iconDomainFor(entry.website),
      version: null,
      implied: true,
      detectedBy: [],
    });
  }

  // 5. Sort deterministically: direct before implied, then by name.
  results.sort((a, b) => {
    if (a.implied !== b.implied) return a.implied ? 1 : -1;
    return a.name.localeCompare(b.name, "en");
  });

  return results;
}
