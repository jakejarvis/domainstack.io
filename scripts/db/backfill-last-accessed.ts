import * as dotenv from "dotenv";

// Load common local envs first if present, then default .env
dotenv.config({ path: ".env.local" });
dotenv.config();

import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { domains } from "@/lib/db/schema";

/**
 * Backfill lastAccessedAt for all existing domains.
 * Sets all domains to the current timestamp to indicate they were recently active.
 * This ensures existing domains start with normal revalidation cadence.
 */
async function backfillLastAccessed() {
  console.info("[backfill] Starting lastAccessedAt backfill...");

  const now = new Date();
  const BATCH_SIZE = 1000;
  let totalUpdated = 0;

  try {
    // Get total count first
    const countResult = await db.execute<{ count: string }>(
      sql`SELECT COUNT(*) as count FROM ${domains}`,
    );
    const total = Number.parseInt(countResult.rows[0]?.count ?? "0", 10);

    console.info(`[backfill] Found ${total} domains to update`);

    // Process in batches to avoid overwhelming the database
    let offset = 0;
    while (offset < total) {
      const updated = await db
        .update(domains)
        .set({
          lastAccessedAt: now,
          updatedAt: now,
        })
        .where(sql`${domains.id} IN (
          SELECT ${domains.id}
          FROM ${domains}
          ORDER BY ${domains.id}
          LIMIT ${BATCH_SIZE}
          OFFSET ${offset}
        )`)
        .returning({ id: domains.id });

      const batchSize = updated.length;
      totalUpdated += batchSize;
      offset += BATCH_SIZE;

      console.info(
        `[backfill] Progress: ${totalUpdated}/${total} (${Math.round((totalUpdated / total) * 100)}%)`,
      );

      // Small delay between batches to avoid overloading the database
      if (offset < total) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.info(`[backfill] ✓ Successfully updated ${totalUpdated} domains`);
    process.exit(0);
  } catch (err) {
    console.error(
      "[backfill] ✗ Failed:",
      err instanceof Error ? err : new Error(String(err)),
    );
    process.exit(1);
  }
}

// Run the backfill
backfillLastAccessed().catch((err) => {
  console.error(err);
  process.exit(1);
});
