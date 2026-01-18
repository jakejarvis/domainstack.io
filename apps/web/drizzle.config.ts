import * as dotenv from "dotenv";

// Load common local envs first if present, then default .env
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
