import type { ProviderCategory } from "@domainstack/constants";
import { z } from "zod";
import type { Rule } from "./rules";
import { RuleSchema } from "./rules";

/**
 * A provider entry as stored in the catalog.
 */
const ProviderEntrySchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  rule: RuleSchema,
});

export type ProviderEntry = z.infer<typeof ProviderEntrySchema>;

/**
 * A full provider entry with category.
 */
export interface Provider extends ProviderEntry {
  category: ProviderCategory;
}

/**
 * Schema for the full provider catalog.
 *
 * Structure:
 * ```json
 * {
 *   "ca": [...],
 *   "dns": [...],
 *   "email": [...],
 *   "hosting": [...],
 *   "registrar": [...]
 * }
 * ```
 */
const ProviderCatalogSchema = z
  .object({
    ca: z.array(ProviderEntrySchema).default([]),
    dns: z.array(ProviderEntrySchema).default([]),
    email: z.array(ProviderEntrySchema).default([]),
    hosting: z.array(ProviderEntrySchema).default([]),
    registrar: z.array(ProviderEntrySchema).default([]),
  })
  .superRefine((catalog, ctx) => {
    // Validate all regex patterns at parse time
    const validateRegexInRule = (
      rule: Rule,
      category: string,
      providerName: string,
      path: string[],
    ): void => {
      if ("all" in rule) {
        for (let i = 0; i < rule.all.length; i++) {
          validateRegexInRule(rule.all[i], category, providerName, [
            ...path,
            "all",
            String(i),
          ]);
        }
      } else if ("any" in rule) {
        for (let i = 0; i < rule.any.length; i++) {
          validateRegexInRule(rule.any[i], category, providerName, [
            ...path,
            "any",
            String(i),
          ]);
        }
      } else if ("not" in rule) {
        validateRegexInRule(rule.not, category, providerName, [...path, "not"]);
      } else if (rule.kind === "mxRegex" || rule.kind === "nsRegex") {
        try {
          new RegExp(rule.pattern, rule.flags);
        } catch (e) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid regex pattern in ${category}.${providerName}: ${rule.pattern} - ${e instanceof Error ? e.message : "unknown error"}`,
            path: [...path, "pattern"],
          });
        }
      }
    };

    const categories: ProviderCategory[] = [
      "ca",
      "dns",
      "email",
      "hosting",
      "registrar",
    ];
    for (const category of categories) {
      const providers = catalog[category];
      for (let index = 0; index < providers.length; index++) {
        const provider = providers[index];
        validateRegexInRule(provider.rule, category, provider.name, [
          category,
          String(index),
          "rule",
        ]);
      }
    }
  });

export type ProviderCatalog = z.infer<typeof ProviderCatalogSchema>;

/**
 * Parse and validate a raw provider catalog.
 *
 * @param raw - Raw JSON object
 * @returns Validated ProviderCatalog
 * @throws ZodError if validation fails
 */
export function parseProviderCatalog(raw: unknown): ProviderCatalog {
  return ProviderCatalogSchema.parse(raw);
}

/**
 * Safely parse a provider catalog, returning a result object.
 *
 * @param raw - Raw JSON object
 * @returns Validated ProviderCatalog or error
 */
export function safeParseProviderCatalog(
  raw: unknown,
):
  | { success: true; data: ProviderCatalog }
  | { success: false; error: z.ZodError } {
  return ProviderCatalogSchema.safeParse(raw);
}

/**
 * Extract providers of a specific category from a parsed catalog.
 */
export function getProvidersFromCatalog(
  catalog: ProviderCatalog,
  category: ProviderCategory,
): Provider[] {
  const entries = catalog[category];
  return entries.map((entry) => ({ ...entry, category }));
}
