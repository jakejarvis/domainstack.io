import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/lib/db/schema";

// Dynamic import via require pattern is recommended in community examples
// to access drizzle-kit/api in Vitest.
const { pushSchema } =
  require("drizzle-kit/api") as typeof import("drizzle-kit/api");

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
    const origLog = console.log;
    try {
      console.log = (...args: unknown[]) => {
        const s = String(args[0] ?? "");
        if (s.includes("Pulling schema from database")) return;
        origLog(...args);
      };
      await apply();
    } finally {
      console.log = origLog;
    }
    schemaApplied = true;
  }

  return cached;
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
    providers,
    domains,
  } = schema;
  await db.delete(dnsRecords);
  await db.delete(httpHeaders);
  await db.delete(certificates);
  await db.delete(registrations);
  await db.delete(hosting);
  await db.delete(seo);
  await db.delete(providers);
  await db.delete(domains);
}
