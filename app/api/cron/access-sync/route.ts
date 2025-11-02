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

    // Scan for all access keys
    const pattern = ns("access", "domain", "*");
    const keys = await redis.keys(pattern);

    if (keys.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        message: "no access data to sync",
      });
    }

    // Fetch all timestamps
    const timestamps = await redis.mget<number[]>(...keys);

    // Build update batch
    const updates: Array<{ name: string; accessedAt: Date }> = [];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const timestamp = timestamps[i];

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
      return NextResponse.json({
        success: true,
        synced: 0,
        message: "no valid access data to sync",
      });
    }

    // Batch update to Postgres (100 at a time to avoid overwhelming DB)
    const BATCH_SIZE = 100;
    let synced = 0;

    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const chunk = updates.slice(i, i + BATCH_SIZE);
      await batchUpdateLastAccessed(chunk);

      // Delete synced keys from Redis
      const keysToDelete = chunk.map((u) => ns("access", "domain", u.name));
      await redis.del(...keysToDelete);

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
