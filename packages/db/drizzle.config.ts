import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// packages/db/.env wins; fall back to the web app's env file used by `pnpm dev`
config({ path: [".env", "../../apps/web/.env.local"], quiet: true });

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
});
