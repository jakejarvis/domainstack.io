import "server-only";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { type providerCategory, providers } from "@/lib/db/schema";
import { createLogger } from "@/lib/logger/server";
import { slugify } from "@/lib/slugify";

const logger = createLogger({ source: "providers" });

export type ResolveProviderInput = {
  category: (typeof providerCategory.enumValues)[number];
  domain?: string | null;
  name?: string | null;
};

/**
 * Generate a normalized lookup key for provider identification.
 * Keys are case-insensitive to match SQL comparison semantics.
 */
export function makeProviderKey(
  category: string,
  domain: string | null | undefined,
  name: string | null | undefined,
): string {
  const domainNorm = domain ? domain.trim().toLowerCase() : "";
  const nameNorm = name ? name.trim().toLowerCase() : "";
  return `${category}|${domainNorm}|${nameNorm}`;
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

function isUniqueViolation(err: unknown): err is { code: string } {
  if (!err || typeof err !== "object") return false;

  // Check direct error
  if ("code" in err && (err as { code: string }).code === "23505") {
    return true;
  }

  // Check wrapped error (e.g. Drizzle/Postgres cause)
  if (
    "cause" in err &&
    err.cause &&
    typeof err.cause === "object" &&
    "code" in err.cause &&
    (err.cause as { code: string }).code === "23505"
  ) {
    return true;
  }

  return false;
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
 * Batch resolve or create multiple providers efficiently.
 * Returns a map keyed by a stable string representation of the input.
 */
export async function batchResolveOrCreateProviderIds(
  inputs: ResolveProviderInput[],
): Promise<Map<string, string | null>> {
  if (inputs.length === 0) return new Map();

  // Normalize inputs and create lookup keys
  const normalized = inputs.map((input) => ({
    category: input.category,
    domain: input.domain ? input.domain.trim().toLowerCase() : null,
    name: input.name?.trim() ?? null,
  }));

  // Deduplicate inputs
  const uniqueInputs = Array.from(
    new Map(
      normalized.map((n) => [makeProviderKey(n.category, n.domain, n.name), n]),
    ).values(),
  );

  // Build OR conditions for batch query
  const conditions = uniqueInputs
    .map((input) => {
      if (input.domain) {
        return and(
          eq(providers.category, input.category),
          eq(providers.domain, input.domain),
        );
      }
      if (input.name) {
        return and(
          eq(providers.category, input.category),
          eq(sql`lower(${providers.name})`, input.name.toLowerCase()),
        );
      }
      return null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // Fetch all existing providers in one query
  const existing =
    conditions.length > 0
      ? await db
          .select({
            id: providers.id,
            category: providers.category,
            name: providers.name,
            domain: providers.domain,
          })
          .from(providers)
          .where(or(...conditions))
      : [];

  // Build map of existing providers
  // Store both domain-specific and name-only keys to mirror single-row fallback semantics
  const existingMap = new Map<string, string>();
  for (const row of existing) {
    const domainKey = makeProviderKey(row.category, row.domain, row.name);
    const nameOnlyKey = makeProviderKey(row.category, null, row.name);

    if (!existingMap.has(domainKey)) {
      existingMap.set(domainKey, row.id);
    }
    // Also record name-only key so inputs with domain can fall back to name-only rows
    if (!existingMap.has(nameOnlyKey)) {
      existingMap.set(nameOnlyKey, row.id);
    }
  }

  // Identify missing providers
  // Check domain-specific key first, then fall back to name-only key
  const toCreate = uniqueInputs.filter((input) => {
    if (!input.name) return false;
    const domainKey = makeProviderKey(input.category, input.domain, input.name);
    const nameOnlyKey = makeProviderKey(input.category, null, input.name);
    return !existingMap.has(domainKey) && !existingMap.has(nameOnlyKey);
  });

  // Batch create missing providers
  if (toCreate.length > 0) {
    // Deduplicate by slug to prevent insertion conflicts within the batch
    // Multiple providers with same name+category but different domains can have same slug
    const slugMap = new Map<string, (typeof toCreate)[0]>();
    const values: Array<{
      category: (typeof providerCategory.enumValues)[number];
      name: string;
      domain: string | undefined;
      slug: string;
      source: "discovered";
    }> = [];

    for (const input of toCreate) {
      const slug = slugify(input.name as string);
      const slugKey = `${input.category}|${slug}`;

      // Only add first occurrence of each category+slug combination
      if (!slugMap.has(slugKey)) {
        slugMap.set(slugKey, input);
        values.push({
          category: input.category,
          name: input.name as string,
          domain: input.domain ?? undefined,
          slug,
          source: "discovered" as const,
        });
      }
    }

    try {
      const inserted = await db
        .insert(providers)
        .values(values)
        .onConflictDoNothing({
          target: [providers.category, providers.slug],
        })
        .returning({
          id: providers.id,
          category: providers.category,
          name: providers.name,
          domain: providers.domain,
        });

      // Add newly created providers to the map
      // Store both domain-specific and name-only keys for fallback
      for (const row of inserted) {
        const domainKey = makeProviderKey(row.category, row.domain, row.name);
        const nameOnlyKey = makeProviderKey(row.category, null, row.name);

        if (!existingMap.has(domainKey)) {
          existingMap.set(domainKey, row.id);
        }
        if (!existingMap.has(nameOnlyKey)) {
          existingMap.set(nameOnlyKey, row.id);
        }
      }

      // Handle any that weren't inserted due to conflicts (race condition)
      const stillMissing = toCreate.filter((input) => {
        const domainKey = makeProviderKey(
          input.category,
          input.domain,
          input.name,
        );
        const nameOnlyKey = makeProviderKey(input.category, null, input.name);
        return !existingMap.has(domainKey) && !existingMap.has(nameOnlyKey);
      });
      if (stillMissing.length > 0) {
        // Fetch the conflicted ones
        const conflictConditions = stillMissing
          .map((input) => {
            if (input.name) {
              return and(
                eq(providers.category, input.category),
                eq(sql`lower(${providers.name})`, input.name.toLowerCase()),
              );
            }
            return null;
          })
          .filter((c): c is NonNullable<typeof c> => c !== null);

        if (conflictConditions.length > 0) {
          const conflicted = await db
            .select({
              id: providers.id,
              category: providers.category,
              name: providers.name,
              domain: providers.domain,
            })
            .from(providers)
            .where(or(...conflictConditions));

          for (const row of conflicted) {
            const domainKey = makeProviderKey(
              row.category,
              row.domain,
              row.name,
            );
            const nameOnlyKey = makeProviderKey(row.category, null, row.name);

            if (!existingMap.has(domainKey)) {
              existingMap.set(domainKey, row.id);
            }
            if (!existingMap.has(nameOnlyKey)) {
              existingMap.set(nameOnlyKey, row.id);
            }
          }
        }
      }
    } catch (err) {
      logger.error("batch insert partial failure", err, {
        count: toCreate.length,
      });

      // Fall back to individual resolution for failed items
      for (const input of toCreate) {
        const domainKey = makeProviderKey(
          input.category,
          input.domain,
          input.name,
        );
        const nameOnlyKey = makeProviderKey(input.category, null, input.name);

        if (!existingMap.has(domainKey) && !existingMap.has(nameOnlyKey)) {
          try {
            const id = await resolveOrCreateProviderId(input);
            if (id) {
              existingMap.set(domainKey, id);
              existingMap.set(nameOnlyKey, id);
            }
          } catch {
            // Skip individual failures
          }
        }
      }
    }
  }

  // Build final result map matching original inputs
  // Use domain-specific key first, fall back to name-only key (mirrors single-row resolver)
  const result = new Map<string, string | null>();
  for (const input of normalized) {
    const requestKey = makeProviderKey(
      input.category,
      input.domain,
      input.name,
    );
    const domainKey = makeProviderKey(input.category, input.domain, input.name);
    const nameOnlyKey = makeProviderKey(input.category, null, input.name);

    // Try domain-specific key first, then fall back to name-only key
    const id =
      existingMap.get(domainKey) ?? existingMap.get(nameOnlyKey) ?? null;
    result.set(requestKey, id);
  }

  return result;
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
