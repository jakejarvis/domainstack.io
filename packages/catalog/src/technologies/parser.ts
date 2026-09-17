import { z } from "zod";

import { TECHNOLOGY_CATEGORIES } from "@domainstack/constants";

import type { TechRule } from "./rules";
import { TechRuleSchema } from "./rules";

const TechnologyEntrySchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case"),
  name: z.string().min(1),
  categories: z.array(z.enum(TECHNOLOGY_CATEGORIES)).min(1),
  website: z.url(),
  /** Slugs this entry pulls in when it matches. Resolved transitively. */
  implies: z.array(z.string()).optional(),
  /** Slugs removed from the results when this entry matches. */
  excludes: z.array(z.string()).optional(),
  rule: TechRuleSchema,
});

export type TechnologyEntry = z.infer<typeof TechnologyEntrySchema>;

type TechRuleLeaf = Extract<TechRule, { kind: string }>;

/** Walk a rule tree, reporting each leaf with its path (for issue messages). */
function walkRule(
  rule: TechRule,
  path: (string | number)[],
  visit: (leaf: TechRuleLeaf, path: (string | number)[]) => void,
): void {
  if ("all" in rule) {
    rule.all.forEach((r, i) => walkRule(r, [...path, "all", i], visit));
    return;
  }
  if ("any" in rule) {
    rule.any.forEach((r, i) => walkRule(r, [...path, "any", i], visit));
    return;
  }
  if ("not" in rule) {
    walkRule(rule.not, [...path, "not"], visit);
    return;
  }
  visit(rule, path);
}

/** Count capture groups in a pattern using the empty-alternation trick. */
function countCaptureGroups(pattern: string, flags?: string): number | null {
  try {
    const re = new RegExp(`${pattern}|`, flags ?? "i");
    const result = re.exec("");
    return result ? result.length - 1 : null;
  } catch {
    return null;
  }
}

/**
 * Schema for the full technology catalog: a flat array. Unlike the provider
 * catalog, entries are not grouped by category — a technology can belong to
 * several, so the category lives on the entry.
 */
export const TechnologyCatalogSchema = z
  .array(TechnologyEntrySchema)
  .superRefine((catalog, ctx) => {
    const slugCounts = new Map<string, number>();
    const knownSlugs = new Set(catalog.map((e) => e.slug));

    catalog.forEach((entry, entryIndex) => {
      // 1. Uncompilable regex + 2. version index out of range
      walkRule(entry.rule, [entryIndex, "rule"], (leaf, path) => {
        if (!("pattern" in leaf) || leaf.pattern === undefined) return;

        let compiles = true;
        try {
          new RegExp(leaf.pattern, leaf.flags);
        } catch (e) {
          compiles = false;
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid regex pattern in ${entry.slug}: ${leaf.pattern} - ${e instanceof Error ? e.message : "unknown error"}`,
            path: [...path, "pattern"],
          });
        }

        if (compiles && "version" in leaf && leaf.version !== undefined) {
          const groupCount = countCaptureGroups(leaf.pattern, leaf.flags);
          if (leaf.version < 1 || groupCount === null || leaf.version > groupCount) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `version index ${leaf.version} out of range for pattern in ${entry.slug} (pattern has ${groupCount ?? 0} capture group(s))`,
              path: [...path, "version"],
            });
          }
        }
      });

      // 3. Duplicate slug
      slugCounts.set(entry.slug, (slugCounts.get(entry.slug) ?? 0) + 1);

      // 4. Unknown implies/excludes target
      for (const target of entry.implies ?? []) {
        if (!knownSlugs.has(target)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${entry.slug} implies unknown slug "${target}"`,
            path: [entryIndex, "implies"],
          });
        }
      }
      for (const target of entry.excludes ?? []) {
        if (!knownSlugs.has(target)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${entry.slug} excludes unknown slug "${target}"`,
            path: [entryIndex, "excludes"],
          });
        }
      }
    });

    for (const [slug, count] of slugCounts) {
      if (count > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate slug "${slug}"`,
          path: ["slug"],
        });
      }
    }

    // 5. implies cycle - depth-first walk over the implies graph
    const impliesBySlug = new Map(catalog.map((e) => [e.slug, e.implies ?? []]));
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const reportedCycles = new Set<string>();

    const detectCycle = (slug: string, stack: string[]): void => {
      if (visited.has(slug)) return;
      if (visiting.has(slug)) {
        const cycleStart = stack.indexOf(slug);
        const cycle = [...stack.slice(cycleStart), slug];
        const key = [...new Set(cycle)].sort().join(",");
        if (!reportedCycles.has(key)) {
          reportedCycles.add(key);
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `implies cycle: ${cycle.join(" -> ")}`,
            path: ["implies"],
          });
        }
        return;
      }
      visiting.add(slug);
      for (const target of impliesBySlug.get(slug) ?? []) {
        if (impliesBySlug.has(target)) {
          detectCycle(target, [...stack, slug]);
        }
      }
      visiting.delete(slug);
      visited.add(slug);
    };

    for (const slug of impliesBySlug.keys()) {
      detectCycle(slug, []);
    }
  });

export type TechnologyCatalog = z.infer<typeof TechnologyCatalogSchema>;
