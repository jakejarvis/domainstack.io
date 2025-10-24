import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { type providerCategory, providers } from "@/lib/db/schema";

export type ResolveProviderInput = {
  category: (typeof providerCategory.enumValues)[number];
  domain?: string | null;
  name?: string | null;
};

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
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
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
