import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/lib/db/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // Throw at import time so we fail fast in server-only contexts
  throw new Error("DATABASE_URL is not set");
}

// Create explicit pool instance for better connection management
const pool = new Pool({
  connectionString,
});

// Attach to Vercel's pool management to ensure idle connections are properly
// released before fluid compute functions suspend:
// https://vercel.com/guides/connection-pooling-with-functions
try {
  attachDatabasePool(pool);
} catch {
  // ignore
}

// Pass pool to Drizzle with schema
export const db = drizzle(pool, { schema });
