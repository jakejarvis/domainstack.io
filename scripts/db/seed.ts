/**
 * Seed providers from catalog into the database.
 *
 * This script syncs the provider catalog to the database by:
 * - Inserting new catalog providers (matched by name/slug)
 * - Updating existing providers to match catalog definitions (matched by name/slug)
 * - Replacing "discovered" providers with catalog providers when rules match
 *
 * Providers are matched by:
 * 1. Primary: slug (derived from name) within the same category
 * 2. Secondary: rule evaluation for discovered providers (e.g., catalog provider
 *    with mxSuffix "tutanota.de" replaces discovered provider "mail.tutanota.de")
 *
 * Multiple providers can share the same domain (e.g., Amazon S3, CloudFront both use aws.amazon.com).
 *
 * Usage:
 *   pnpm db:seed             # Apply changes to database
 *   pnpm db:seed --dry-run   # Preview changes without applying them
 */

import * as dotenv from "dotenv";

// Load common local envs first if present, then default .env
dotenv.config({ path: ".env.local" });
dotenv.config();

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  certificates,
  hosting,
  type providerCategory,
  providers,
  registrations,
} from "@/lib/db/schema";
import {
  CA_PROVIDERS,
  DNS_PROVIDERS,
  EMAIL_PROVIDERS,
  HOSTING_PROVIDERS,
  REGISTRAR_PROVIDERS,
} from "@/lib/providers/catalog";
import { evalRule } from "@/lib/providers/detection";
import type { DetectionContext, Provider, Rule } from "@/lib/schemas";
import { slugify } from "@/lib/slugify";

type SeedDef = {
  name: string;
  domain: string | null;
  category: (typeof providerCategory.enumValues)[number];
  rule?: Rule;
  aliases?: string[];
};

function collect(): SeedDef[] {
  const arr: SeedDef[] = [];
  const push = (cat: SeedDef["category"], src: Provider[]) => {
    for (const p of src)
      arr.push({
        name: p.name,
        domain: p.domain ?? null,
        category: cat,
        rule: p.rule,
      });
  };
  push("dns", DNS_PROVIDERS);
  push("email", EMAIL_PROVIDERS);
  push("hosting", HOSTING_PROVIDERS);
  push("registrar", REGISTRAR_PROVIDERS);
  push("ca", CA_PROVIDERS);
  return arr;
}

/**
 * Check if a catalog provider's rules would match a discovered provider.
 *
 * For example:
 * - Catalog provider "Tuta" with mxSuffix "tutanota.de"
 * - Discovered provider named "mail.tutanota.de" (from MX record)
 * - Returns true because the catalog rule matches the discovered name
 */
function catalogRuleMatchesDiscovered(
  catalogDef: SeedDef,
  discoveredProvider: { name: string; domain: string | null },
): boolean {
  if (!catalogDef.rule) return false;

  // Build detection context based on discovered provider's name/domain
  // The discovered name is typically extracted from DNS records (MX/NS/etc.)
  const ctx: DetectionContext = {
    headers: {},
    mx: [],
    ns: [],
  };

  // Populate context based on category to test if catalog rules would match
  switch (catalogDef.category) {
    case "email":
      // Discovered email providers are typically auto-created from MX record hostnames
      ctx.mx = [discoveredProvider.name];
      if (discoveredProvider.domain) ctx.mx.push(discoveredProvider.domain);
      break;
    case "dns":
      // Discovered DNS providers are typically auto-created from NS record hostnames
      ctx.ns = [discoveredProvider.name];
      if (discoveredProvider.domain) ctx.ns.push(discoveredProvider.domain);
      break;
    case "hosting":
      // Hosting providers use header-based detection, harder to match retrospectively
      // Skip rule-based matching for hosting
      return false;
    case "ca":
      // CA providers use issuer string detection
      if (discoveredProvider.name) {
        ctx.issuer = discoveredProvider.name.toLowerCase();
      }
      break;
    case "registrar":
      // Registrar providers use registrar name detection
      if (discoveredProvider.name) {
        ctx.registrar = discoveredProvider.name.toLowerCase();
      }
      break;
  }

  try {
    return evalRule(catalogDef.rule, ctx);
  } catch (err) {
    console.warn(
      `Failed to evaluate rule for ${catalogDef.name} against ${discoveredProvider.name}:`,
      err,
    );
    return false;
  }
}

async function main() {
  // Parse command-line arguments
  const isDryRun = process.argv.includes("--dry-run");

  if (isDryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made to the database\n");
  }

  const defs = collect();
  let inserted = 0;
  let updated = 0;

  console.log(`Fetching existing providers...`);
  // Fetch all existing providers at once to avoid N+1 queries
  const allExisting = await db.select().from(providers);

  // Build lookup map for fast slug-based comparison
  const bySlug = new Map<string, (typeof allExisting)[number]>();

  for (const existing of allExisting) {
    // Key: "category:slug"
    const slugKey = `${existing.category}:${existing.slug}`;
    bySlug.set(slugKey, existing);
  }

  console.log(`Processing ${defs.length} provider definitions...`);
  const toInsert: Array<typeof providers.$inferInsert> = [];
  const toUpdate: Array<{
    id: string;
    name: string;
    slug: string;
    source: "catalog";
    domain: string | null;
  }> = [];

  for (const def of defs) {
    const slug = slugify(def.name);
    const lowerDomain = def.domain ? def.domain.toLowerCase() : null;

    // Match by slug (name-based matching)
    // The slug (derived from provider name) is the ONLY identifier for catalog-to-catalog
    // Domain is NOT unique since multiple services share parent company domains
    // (e.g., Amazon S3, CloudFront, Route 53 all use aws.amazon.com)
    const slugKey = `${def.category}:${slug}`;
    const existing = bySlug.get(slugKey);

    if (!existing) {
      // No exact slug match - check if catalog rules match any discovered providers
      let ruleMatched = false;

      if (def.rule) {
        for (const [_existingSlugKey, existingProvider] of bySlug.entries()) {
          // Only consider discovered providers in the same category
          if (
            existingProvider.source === "discovered" &&
            existingProvider.category === def.category
          ) {
            if (
              catalogRuleMatchesDiscovered(def, {
                name: existingProvider.name,
                domain: existingProvider.domain,
              })
            ) {
              // Catalog rule matches this discovered provider - replace it
              toUpdate.push({
                id: existingProvider.id,
                name: def.name,
                slug,
                source: "catalog",
                domain: lowerDomain,
              });
              updated++;
              ruleMatched = true;

              // Update the bySlug map to prevent duplicate matches
              const oldSlugKey = `${existingProvider.category}:${existingProvider.slug}`;
              bySlug.delete(oldSlugKey);
              bySlug.set(slugKey, {
                ...existingProvider,
                name: def.name,
                slug,
                source: "catalog",
                domain: lowerDomain,
              });

              console.log(
                `  📝 Replacing discovered "${existingProvider.name}" with catalog "${def.name}" (rule match)`,
              );
              break; // Only replace one discovered provider per catalog entry
            }
          }
        }
      }

      if (!ruleMatched) {
        // New record - queue for insert
        toInsert.push({
          name: def.name,
          domain: lowerDomain,
          category: def.category,
          slug,
          source: "catalog",
        });
        inserted++;
      }
    } else {
      // Existing record - check if update is needed
      const needsUpdate =
        existing.name !== def.name ||
        existing.slug !== slug ||
        existing.source !== "catalog" ||
        existing.domain !== lowerDomain;

      if (needsUpdate) {
        // Check if updating the slug would create a conflict with another record
        const targetSlugKey = `${def.category}:${slug}`;
        const conflictingRecord = bySlug.get(targetSlugKey);

        if (conflictingRecord && conflictingRecord.id !== existing.id) {
          // Conflict: another record already has this (category, slug)
          // Skip this update to avoid violating unique constraint
          console.warn(
            `⚠️  Skipping update for "${def.name}": (${def.category}, ${slug}) conflicts with existing record "${conflictingRecord.name}"`,
          );
        } else {
          toUpdate.push({
            id: existing.id,
            name: def.name,
            slug,
            source: "catalog",
            domain: lowerDomain,
          });
          updated++;
        }
      }
    }
  }

  // Batch insert new providers
  if (toInsert.length > 0) {
    // Deduplicate by (category, slug) to prevent constraint violations
    // This handles cases where multiple catalog entries map to the same slug
    // (e.g., multiple rules for the same provider)
    const uniqueInserts = new Map<string, (typeof toInsert)[number]>();
    for (const ins of toInsert) {
      const key = `${ins.category}:${ins.slug}`;
      if (!uniqueInserts.has(key)) {
        uniqueInserts.set(key, ins);
      } else {
        console.warn(
          `⚠️  Skipping duplicate insert for "${ins.name}" (slug: ${ins.slug}) - already queued`,
        );
      }
    }
    const deduplicatedInserts = Array.from(uniqueInserts.values());

    console.log(
      `${isDryRun ? "[DRY RUN] Would insert" : "Inserting"} ${deduplicatedInserts.length} new provider(s)...`,
    );
    if (isDryRun) {
      for (const ins of deduplicatedInserts) {
        console.log(
          `  - ${ins.category}: ${ins.name} (${ins.domain || "no domain"})`,
        );
      }
    } else {
      await db.insert(providers).values(deduplicatedInserts);
    }
  }

  // Batch update existing providers
  if (toUpdate.length > 0) {
    console.log(
      `${isDryRun ? "[DRY RUN] Would update" : "Updating"} ${toUpdate.length} provider(s)...`,
    );
    if (isDryRun) {
      for (const update of toUpdate) {
        console.log(`  - ${update.name} (${update.domain || "no domain"})`);
      }
    } else {
      for (const update of toUpdate) {
        await db
          .update(providers)
          .set({
            name: update.name,
            slug: update.slug,
            source: update.source,
            domain: update.domain,
            updatedAt: sql`now()`,
          })
          .where(eq(providers.id, update.id));
      }
    }
  }

  // Cleanup phase: Remove orphaned discovered providers that match catalog rules
  // This handles leftovers from the old logic where both catalog and discovered versions exist
  console.log("\nCleaning up orphaned discovered providers...");

  // Refresh the provider list after inserts/updates
  const refreshedProviders = await db.select().from(providers);

  // Build a map of catalog providers by category
  const catalogByCategory = new Map<
    string,
    Array<{
      id: string;
      name: string;
      domain: string | null;
      rule?: Rule;
    }>
  >();

  for (const def of defs) {
    const slug = slugify(def.name);

    // Find the corresponding provider in the refreshed list
    const provider = refreshedProviders.find(
      (p) => p.category === def.category && p.slug === slug,
    );

    if (provider && def.rule) {
      if (!catalogByCategory.has(def.category)) {
        catalogByCategory.set(def.category, []);
      }
      catalogByCategory.get(def.category)?.push({
        id: provider.id,
        name: provider.name,
        domain: provider.domain,
        rule: def.rule,
      });
    }
  }

  // Find discovered providers that should be merged into catalog providers
  const toCleanup: Array<{
    discoveredId: string;
    discoveredName: string;
    catalogId: string;
    catalogName: string;
  }> = [];

  for (const discovered of refreshedProviders) {
    // Only process discovered providers
    if (discovered.source !== "discovered") continue;

    const catalogProviders = catalogByCategory.get(discovered.category) ?? [];

    // Check if any catalog provider's rules match this discovered provider
    for (const catalog of catalogProviders) {
      // Skip if this is the same provider (shouldn't happen, but safeguard)
      if (catalog.id === discovered.id) continue;

      if (
        catalogRuleMatchesDiscovered(
          {
            name: catalog.name,
            domain: catalog.domain,
            category: discovered.category,
            rule: catalog.rule,
          },
          {
            name: discovered.name,
            domain: discovered.domain,
          },
        )
      ) {
        toCleanup.push({
          discoveredId: discovered.id,
          discoveredName: discovered.name,
          catalogId: catalog.id,
          catalogName: catalog.name,
        });
        break; // Only match one catalog provider per discovered provider
      }
    }
  }

  let cleaned = 0;

  if (toCleanup.length > 0) {
    console.log(
      `${isDryRun ? "[DRY RUN] Would clean up" : "Cleaning up"} ${toCleanup.length} orphaned provider(s)...`,
    );

    for (const cleanup of toCleanup) {
      console.log(
        `  🧹 Merging "${cleanup.discoveredName}" → "${cleanup.catalogName}"`,
      );

      if (!isDryRun) {
        try {
          // Wrap all FK migrations and deletion in a single transaction
          // to ensure atomicity - either all succeed or all rollback
          await db.transaction(async (tx) => {
            // Migrate foreign key references from discovered → catalog
            // Update registrations table
            await tx
              .update(registrations)
              .set({ registrarProviderId: cleanup.catalogId })
              .where(
                eq(registrations.registrarProviderId, cleanup.discoveredId),
              );

            await tx
              .update(registrations)
              .set({ resellerProviderId: cleanup.catalogId })
              .where(
                eq(registrations.resellerProviderId, cleanup.discoveredId),
              );

            // Update certificates table
            await tx
              .update(certificates)
              .set({ caProviderId: cleanup.catalogId })
              .where(eq(certificates.caProviderId, cleanup.discoveredId));

            // Update hosting table
            await tx
              .update(hosting)
              .set({ hostingProviderId: cleanup.catalogId })
              .where(eq(hosting.hostingProviderId, cleanup.discoveredId));

            await tx
              .update(hosting)
              .set({ emailProviderId: cleanup.catalogId })
              .where(eq(hosting.emailProviderId, cleanup.discoveredId));

            await tx
              .update(hosting)
              .set({ dnsProviderId: cleanup.catalogId })
              .where(eq(hosting.dnsProviderId, cleanup.discoveredId));

            // Delete the orphaned discovered provider
            await tx
              .delete(providers)
              .where(eq(providers.id, cleanup.discoveredId));
          });

          cleaned++;
        } catch (err) {
          console.error(
            `❌ Failed to merge "${cleanup.discoveredName}" → "${cleanup.catalogName}":`,
            err,
          );
          throw err; // Re-throw to fail the script and prevent incomplete migrations
        }
      } else {
        // Dry run: just count what would be cleaned
        cleaned++;
      }
    }
  } else {
    console.log("  ✨ No orphaned providers found");
  }

  if (isDryRun) {
    console.log(
      `\n✅ DRY RUN COMPLETE: Would have inserted ${inserted}, updated ${updated}, cleaned ${cleaned}`,
    );
  } else {
    console.log(
      `\n✅ Seeded ${inserted} inserted, ${updated} updated, ${cleaned} cleaned`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
