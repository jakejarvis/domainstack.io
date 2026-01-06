import { z } from "zod";
import type { ProviderCategory } from "@/lib/schemas/primitives";
import { type Rule, RuleSchema } from "./rules";

/**
 * A provider entry as stored in the catalog (without category).
 */
export const CatalogProviderEntrySchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  rule: RuleSchema,
});

export type CatalogProviderEntry = z.infer<typeof CatalogProviderEntrySchema>;

/**
 * A full catalog provider with category and rule.
 * Used internally by the providers module for detection.
 */
export interface CatalogProvider extends CatalogProviderEntry {
  category: ProviderCategory;
  rule: Rule;
}

/**
 * Convert a catalog entry to a full CatalogProvider with category.
 */
export function toCatalogProvider(
  entry: CatalogProviderEntry,
  category: ProviderCategory,
): CatalogProvider {
  return {
    ...entry,
    category,
  };
}
