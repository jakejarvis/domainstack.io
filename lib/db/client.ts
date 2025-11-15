import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/lib/db/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // Throw at import time so we fail fast on misconfiguration in server-only context
  throw new Error("DATABASE_URL is not set");
}

export const db = drizzle(connectionString, { schema });
