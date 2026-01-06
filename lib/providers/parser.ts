import { z } from "zod";
import { type Rule, RuleSchema } from "@/lib/providers/rules";
import type { Provider, ProviderCategory } from "@/lib/schemas";

/**
 * Schema for a provider entry without category (category is inferred from the key).
 */
const CatalogProviderEntrySchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  rule: RuleSchema,
});

/**
 * Schema for the full provider catalog stored in Edge Config.
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
export const ProviderCatalogSchema = z
  .object({
    ca: z.array(CatalogProviderEntrySchema).default([]),
    dns: z.array(CatalogProviderEntrySchema).default([]),
    email: z.array(CatalogProviderEntrySchema).default([]),
    hosting: z.array(CatalogProviderEntrySchema).default([]),
    registrar: z.array(CatalogProviderEntrySchema).default([]),
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
 * Type for the raw catalog entry (without category, as stored in Edge Config).
 */
export type CatalogProviderEntry = z.infer<typeof CatalogProviderEntrySchema>;

/**
 * Parse and validate a raw provider catalog from Edge Config.
 *
 * @param raw - Raw JSON object from Edge Config
 * @returns Validated ProviderCatalog
 * @throws ZodError if validation fails
 */
export function parseProviderCatalog(raw: unknown): ProviderCatalog {
  return ProviderCatalogSchema.parse(raw);
}

/**
 * Safely parse a provider catalog, returning null on failure.
 *
 * @param raw - Raw JSON object from Edge Config
 * @returns Validated ProviderCatalog or null if invalid
 */
export function safeParseProviderCatalog(
  raw: unknown,
):
  | { success: true; data: ProviderCatalog }
  | { success: false; error: z.ZodError } {
  const result = ProviderCatalogSchema.safeParse(raw);
  return result;
}

/**
 * Convert a catalog entry to a full Provider with category.
 */
export function toProvider(
  entry: CatalogProviderEntry,
  category: ProviderCategory,
): Provider {
  return {
    ...entry,
    category,
  };
}

/**
 * Extract providers of a specific category from a parsed catalog.
 */
export function getProvidersFromCatalog(
  catalog: ProviderCatalog,
  category: ProviderCategory,
): Provider[] {
  const entries = catalog[category];
  return entries.map((entry) => toProvider(entry, category));
}
