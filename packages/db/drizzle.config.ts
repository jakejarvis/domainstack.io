import { resolve } from "node:path";
import * as dotenv from "dotenv";

// Load env files from monorepo root (where they typically live)
const rootDir = resolve(import.meta.dirname, "../..");
dotenv.config({ path: resolve(rootDir, ".env.local") });
dotenv.config({ path: resolve(rootDir, ".env") });

import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
