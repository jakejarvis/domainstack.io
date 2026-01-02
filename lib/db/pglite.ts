import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/lib/db/schema";
import { createLogger } from "@/lib/logger/server";

// Dynamic import via require pattern is recommended in community examples
// to access drizzle-kit/api in Vitest.
const { pushSchema } =
  require("drizzle-kit/api") as typeof import("drizzle-kit/api");

const logger = createLogger({ source: "pglite" });

type DbBundle = { db: ReturnType<typeof drizzle>; client: PGlite };
let cached: DbBundle | null = null;
let schemaApplied = false;

export async function makePGliteDb(): Promise<DbBundle> {
  // Reuse a single in-memory DB per worker to avoid repeatedly pulling schema
  if (!cached) {
    const client = new PGlite();
    const db = drizzle(client, { schema });
    cached = { db, client };
  }

  // Apply schema only once per worker
  if (!schemaApplied) {
    const { apply } = await pushSchema(
      schema,
      // biome-ignore lint/suspicious/noExplicitAny: ignore type mismatch
      cached.db as any,
    );
    // Silence noisy logs printed by drizzle-kit during schema sync in tests
    const consoleObj = globalThis.console;
    const origLog = consoleObj.log;
    try {
      consoleObj.log = (...args: unknown[]) => {
        const s = String(args[0] ?? "");
        if (s.includes("Pulling schema from database")) return;
        origLog.apply(consoleObj, args as unknown[]);
      };
      await apply();
    } finally {
      consoleObj.log = origLog;
    }
    schemaApplied = true;
  }

  return cached;
}

/**
 * Properly close PGlite client to prevent file handle leaks.
 * CRITICAL: Call this in afterAll() hooks to avoid memory leaks and EPERM errors on macOS.
 */
export async function closePGliteDb(): Promise<void> {
  if (!cached) return;
  try {
    await cached.client.close();
  } catch (err) {
    // Swallow errors on close (client may already be closed)
    logger.error({ err }, "close warning");
  } finally {
    cached = null;
    schemaApplied = false;
  }
}

// Helper for tests to clear all rows between cases while reusing the same DB
export async function resetPGliteDb(): Promise<void> {
  if (!cached) return;
  const { db } = cached;
  // Delete in dependency-friendly order
  const {
    dnsRecords,
    httpHeaders,
    certificates,
    registrations,
    hosting,
    seo,
    favicons,
    screenshots,
    providers,
    domains,
  } = schema;
  await db.delete(dnsRecords);
  await db.delete(httpHeaders);
  await db.delete(certificates);
  await db.delete(registrations);
  await db.delete(hosting);
  await db.delete(seo);
  await db.delete(favicons);
  await db.delete(screenshots);
  await db.delete(providers);
  await db.delete(domains);
}
