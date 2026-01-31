import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

// Lazy-initialized singleton to allow tests to mock before first access
let _db: Database | null = null;
let _pool: Pool | null = null;

function getDb(): Database {
  if (_db) return _db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  _pool = new Pool({ connectionString });
  _db = drizzle(_pool, { schema });

  // Attach to Vercel's pool management if available
  // This ensures idle connections are properly released before fluid compute functions suspend
  // https://vercel.com/guides/connection-pooling-with-functions
  void attachPoolIfVercel(_pool);

  return _db;
}

async function attachPoolIfVercel(pool: Pool) {
  try {
    const { attachDatabasePool } = await import("@vercel/functions");
    attachDatabasePool(pool);
  } catch {
    // Not on Vercel or @vercel/functions not available - that's fine
  }
}

// Proxy that lazily initializes the db on first property access
export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop);
  },
});

/**
 * For testing: allows replacing the db singleton with a test database.
 */
export function __setTestDb(testDb: Database | null): void {
  _db = testDb;
}
