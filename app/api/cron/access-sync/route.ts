import { NextResponse } from "next/server";
import { batchUpdateLastAccessed } from "@/lib/db/repos/domains";
import { ns, redis } from "@/lib/redis";

export async function GET(request: Request) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get("authorization");
  const expectedAuth = process.env.CRON_SECRET
    ? `Bearer ${process.env.CRON_SECRET}`
    : null;

  if (!expectedAuth) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  if (authHeader !== expectedAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const startedAt = Date.now();

    // Scan for all access keys using incremental SCAN (non-blocking)
    const pattern = ns("access", "domain", "*");
    const keys: string[] = [];
    let cursor = "0";

    // Iterate with SCAN until cursor returns to "0"
    do {
      const result = await redis.scan(cursor, {
        match: pattern,
        count: 100, // Reasonable batch size for each scan iteration
      });
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== "0");

    console.info(`[access-sync] found ${keys.length} access keys to process`);

    if (keys.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        message: "no access data to sync",
      });
    }

    // Atomically read and delete each key to avoid race conditions
    // Using GETDEL ensures that if a fresh write happens after we read,
    // it won't be deleted (it will create a new key that survives this sync)
    const updates: Array<{ name: string; accessedAt: Date }> = [];

    for (const key of keys) {
      // Atomic read-and-delete
      const timestamp = await redis.getdel<number>(key);

      if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
        continue;
      }

      // Extract domain name from key: "access:domain:{domain}"
      const parts = key.split(":");
      if (
        parts.length !== 3 ||
        parts[0] !== "access" ||
        parts[1] !== "domain"
      ) {
        continue;
      }
      const domain = parts[2];

      updates.push({
        name: domain,
        accessedAt: new Date(timestamp),
      });
    }

    if (updates.length === 0) {
      console.warn(
        `[access-sync] found ${keys.length} keys but no valid data to sync`,
      );
      return NextResponse.json({
        success: true,
        synced: 0,
        message: "no valid access data to sync",
      });
    }

    console.info(
      `[access-sync] prepared ${updates.length} updates from ${keys.length} keys`,
    );

    // Batch update to Postgres (100 at a time to avoid overwhelming DB)
    const BATCH_SIZE = 100;
    let synced = 0;

    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const chunk = updates.slice(i, i + BATCH_SIZE);
      await batchUpdateLastAccessed(chunk);
      synced += chunk.length;
    }

    console.info(
      `[access-sync] ok synced=${synced} ${Date.now() - startedAt}ms`,
    );

    return NextResponse.json({
      success: true,
      synced,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error(
      "[access-sync] cron failed",
      err instanceof Error ? err : new Error(String(err)),
    );
    return NextResponse.json(
      {
        error: "Internal error",
        message: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
