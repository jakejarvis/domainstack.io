import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { type providerCategory, providers } from "@/lib/db/schema";
import { isUniqueViolation } from "@/lib/db/utils";
import { createLogger } from "@/lib/logger/server";
import { catalogRuleMatchesDiscovered } from "@/lib/providers/detection";
import type { Provider } from "@/lib/providers/parser";
import { slugify } from "@/lib/slugify";

const logger = createLogger({ source: "db/repos/providers" });

interface ResolveProviderInput {
  category: (typeof providerCategory.enumValues)[number];
  domain?: string | null;
  name?: string | null;
}

/**
 * Get provider by ID
 */
export async function getProviderById(providerId: string) {
  const rows = await db
    .select()
    .from(providers)
    .where(eq(providers.id, providerId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Resolve a provider id by exact domain when provided, falling back to case-insensitive name.
 */
export async function resolveProviderId(
  input: ResolveProviderInput,
): Promise<string | null> {
  const { category } = input;
  const domain = input.domain?.toLowerCase() ?? null;
  const name = input.name?.trim() ?? null;

  if (domain) {
    const byDomain = await db
      .select({ id: providers.id })
      .from(providers)
      .where(
        and(eq(providers.category, category), eq(providers.domain, domain)),
      )
      .orderBy(desc(eq(providers.source, "catalog")), desc(providers.updatedAt))
      .limit(1);
    if (byDomain[0]?.id) return byDomain[0].id;
  }
  if (name) {
    const byName = await db
      .select({ id: providers.id })
      .from(providers)
      .where(
        and(
          eq(providers.category, category),
          eq(sql`lower(${providers.name})`, name.toLowerCase()),
        ),
      )
      .orderBy(desc(eq(providers.source, "catalog")), desc(providers.updatedAt))
      .limit(1);
    if (byName[0]?.id) return byName[0].id;
  }
  return null;
}

/** Resolve a provider id, creating a provider row when not found. */
export async function resolveOrCreateProviderId(
  input: ResolveProviderInput,
): Promise<string | null> {
  const existing = await resolveProviderId(input);
  if (existing) return existing;

  const name = input.name?.trim();
  if (!name) return null;

  const domain = input.domain?.toLowerCase() ?? null;
  // Use a simple slug derived from name for uniqueness within category
  const slug = slugify(name);

  try {
    const inserted = await db
      .insert(providers)
      .values({
        category: input.category,
        name,
        domain: domain ?? undefined,
        slug,
        source: "discovered",
      })
      .returning({ id: providers.id });

    return inserted[0]?.id ?? null;
  } catch (err) {
    // Possible race with another insert or slug collision; resolve on unique violation
    if (isUniqueViolation(err)) {
      // First try standard resolution (name/domain match)
      const resolved = await resolveProviderId(input);
      if (resolved) return resolved;

      // If standard resolution failed, it's likely a slug collision with different name.
      // Fetch by slug to return the existing provider ID.
      const bySlug = await db
        .select({ id: providers.id })
        .from(providers)
        .where(
          and(eq(providers.category, input.category), eq(providers.slug, slug)),
        )
        .limit(1);

      if (bySlug[0]?.id) return bySlug[0].id;
    }

    throw err;
  }
}

/**
 * Get provider names by IDs.
 */
export async function getProviderNames(
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();

  const uniqueIds = Array.from(new Set(ids));

  const result = await db
    .select({ id: providers.id, name: providers.name })
    .from(providers)
    .where(inArray(providers.id, uniqueIds));

  return new Map(result.map((r) => [r.id, r.name]));
}

// ============================================================================
// Catalog Provider Upsert (Lazy Insert)
// ============================================================================

/**
 * Provider row type from database.
 */
type ProviderRow = typeof providers.$inferSelect;

/**
 * Upsert a catalog provider into the database.
 *
 * This function implements lazy insertion of catalog providers:
 * 1. Look up existing provider by (category, slug)
 * 2. If found with source="discovered", upgrade to source="catalog"
 * 3. If not found, check if any discovered provider matches via rules and merge
 * 4. If still not found, insert new catalog provider
 *
 * Returns the provider row with database ID for FK references.
 *
 * @param provider - Provider from Edge Config catalog
 * @returns Provider row with database ID
 */
export async function upsertCatalogProvider(
  provider: Provider,
): Promise<ProviderRow> {
  const slug = slugify(provider.name);
  const lowerDomain = provider.domain?.toLowerCase() ?? null;

  // Step 1: Check for existing provider by (category, slug)
  const existing = await db
    .select()
    .from(providers)
    .where(
      and(eq(providers.category, provider.category), eq(providers.slug, slug)),
    )
    .limit(1);

  if (existing[0]) {
    const [row] = existing;

    // If it's already a catalog provider with matching data, return as-is
    if (
      row.source === "catalog" &&
      row.name === provider.name &&
      row.domain === lowerDomain
    ) {
      return row;
    }

    // Upgrade discovered → catalog or update catalog provider data
    const updated = await db
      .update(providers)
      .set({
        name: provider.name,
        domain: lowerDomain,
        source: "catalog",
        updatedAt: sql`now()`,
      })
      .where(eq(providers.id, row.id))
      .returning();

    return updated[0] ?? row;
  }

  // Step 2: No direct match - check if any discovered provider matches via rules
  // This handles cases like discovered "mail.tutanota.de" matching catalog "Tuta"
  const discoveredProviders = await db
    .select()
    .from(providers)
    .where(
      and(
        eq(providers.category, provider.category),
        eq(providers.source, "discovered"),
      ),
    );

  for (const discovered of discoveredProviders) {
    if (
      catalogRuleMatchesDiscovered(provider, {
        name: discovered.name,
        domain: discovered.domain,
      })
    ) {
      // Found a matching discovered provider - merge it
      logger.info(
        {
          discovered: discovered.name,
          catalog: provider.name,
          category: provider.category,
        },
        "merging discovered provider into catalog",
      );

      // Update the discovered provider to become the catalog provider
      const updated = await db
        .update(providers)
        .set({
          name: provider.name,
          slug,
          domain: lowerDomain,
          source: "catalog",
          updatedAt: sql`now()`,
        })
        .where(eq(providers.id, discovered.id))
        .returning();

      if (updated[0]) {
        return updated[0];
      }
    }
  }

  // Step 3: No matches found - insert new catalog provider
  try {
    const inserted = await db
      .insert(providers)
      .values({
        category: provider.category,
        name: provider.name,
        domain: lowerDomain ?? undefined,
        slug,
        source: "catalog",
      })
      .returning();

    if (!inserted[0]) {
      throw new Error("Failed to insert catalog provider");
    }
    return inserted[0];
  } catch (err) {
    // Handle race condition - another request might have inserted
    if (isUniqueViolation(err)) {
      const retried = await db
        .select()
        .from(providers)
        .where(
          and(
            eq(providers.category, provider.category),
            eq(providers.slug, slug),
          ),
        )
        .limit(1);

      if (retried[0]) {
        return retried[0];
      }
    }
    throw err;
  }
}
