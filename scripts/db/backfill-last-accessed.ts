import * as dotenv from "dotenv";

// Load common local envs first if present, then default .env
dotenv.config({ path: ".env.local" });
dotenv.config();

import { asc, gt, inArray, sql } from "drizzle-orm";
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
  let lastId = ""; // Track last processed ID for keyset pagination

  try {
    // Get total count first (for progress reporting)
    const countResult = await db.execute<{ count: string }>(
      sql`SELECT COUNT(*) as count FROM ${domains}`,
    );
    const total = Number.parseInt(countResult.rows[0]?.count ?? "0", 10);

    console.info(`[backfill] Found ${total} domains to update`);

    // Process in batches using keyset pagination (efficient and safe)
    let batchSize = BATCH_SIZE;
    while (batchSize === BATCH_SIZE) {
      // Select next batch of IDs using keyset pagination
      const batch = await db
        .select({ id: domains.id })
        .from(domains)
        .where(lastId ? gt(domains.id, lastId) : undefined)
        .orderBy(asc(domains.id))
        .limit(BATCH_SIZE);

      if (batch.length === 0) {
        break;
      }

      // Update the batch
      const batchIds = batch.map((row) => row.id);
      const updated = await db
        .update(domains)
        .set({
          lastAccessedAt: now,
          updatedAt: now,
        })
        .where(inArray(domains.id, batchIds))
        .returning({ id: domains.id });

      batchSize = updated.length;
      totalUpdated += batchSize;

      // Track the last processed ID for next iteration
      lastId = updated[updated.length - 1].id;

      console.info(
        `[backfill] Progress: ${totalUpdated}/${total} (${Math.round((totalUpdated / total) * 100)}%)`,
      );

      // Stop when fewer than BATCH_SIZE rows returned (no more data)
      if (batchSize < BATCH_SIZE) {
        break;
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
