import "server-only";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { type providerCategory, providers } from "@/lib/db/schema";
import { slugify } from "@/lib/slugify";

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
          sql`lower(${providers.name}) = lower(${name})`,
        ),
      )
      .orderBy(desc(eq(providers.source, "catalog")), desc(providers.updatedAt))
      .limit(1);
    if (byName[0]?.id) return byName[0].id;
  }
  return null;
}

function isUniqueViolation(err: unknown): err is { code: string } {
  return (
    !!err &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
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
    // Possible race with another insert; try resolve again on unique violation
    if (isUniqueViolation(err)) return resolveProviderId(input);
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
          sql`lower(${providers.name}) = lower(${input.name})`,
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
  const existingMap = new Map<string, string>();
  for (const row of existing) {
    const key = makeProviderKey(row.category, row.domain, row.name);
    if (!existingMap.has(key)) {
      existingMap.set(key, row.id);
    }
  }

  // Identify missing providers
  const toCreate = uniqueInputs.filter((input) => {
    if (!input.name) return false;
    return !existingMap.has(
      makeProviderKey(input.category, input.domain, input.name),
    );
  });

  // Batch create missing providers
  if (toCreate.length > 0) {
    const values = toCreate.map((input) => ({
      category: input.category,
      name: input.name as string,
      domain: input.domain ?? undefined,
      slug: slugify(input.name as string),
      source: "discovered" as const,
    }));

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
      for (const row of inserted) {
        const key = makeProviderKey(row.category, row.domain, row.name);
        if (!existingMap.has(key)) {
          existingMap.set(key, row.id);
        }
      }

      // Handle any that weren't inserted due to conflicts (race condition)
      const stillMissing = toCreate.filter(
        (input) =>
          !existingMap.has(
            makeProviderKey(input.category, input.domain, input.name),
          ),
      );
      if (stillMissing.length > 0) {
        // Fetch the conflicted ones
        const conflictConditions = stillMissing
          .map((input) => {
            if (input.name) {
              return and(
                eq(providers.category, input.category),
                sql`lower(${providers.name}) = lower(${input.name})`,
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
            const key = makeProviderKey(row.category, row.domain, row.name);
            if (!existingMap.has(key)) {
              existingMap.set(key, row.id);
            }
          }
        }
      }
    } catch (err) {
      console.warn("[providers] batch insert partial failure", err);
      // Fall back to individual resolution for failed items
      for (const input of toCreate) {
        const key = makeProviderKey(input.category, input.domain, input.name);
        if (!existingMap.has(key)) {
          try {
            const id = await resolveOrCreateProviderId(input);
            if (id) {
              existingMap.set(key, id);
            }
          } catch {
            // Skip individual failures
          }
        }
      }
    }
  }

  // Build final result map matching original inputs
  const result = new Map<string, string | null>();
  for (const input of normalized) {
    const key = makeProviderKey(input.category, input.domain, input.name);
    result.set(key, existingMap.get(key) ?? null);
  }

  return result;
}
