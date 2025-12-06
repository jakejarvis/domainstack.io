import { getPlatformStats } from "@/lib/db/repos/stats";
import { PlatformStatsResponseSchema } from "@/lib/schemas";
import { createTRPCRouter, publicProcedure } from "@/trpc/init";

/**
 * Public stats router for platform-wide statistics.
 *
 * All endpoints are public (no auth required) to allow embedding stats
 * on marketing pages, public dashboards, etc.
 */
export const statsRouter = createTRPCRouter({
  /**
   * Get all platform statistics in a single call.
   *
   * Returns aggregated stats including:
   * - Total unique domains (in database)
   * - Top TLDs
   * - Top providers by category (hosting, registrar, DNS, email, CA)
   * - Growth metrics (recent activity)
   */
  getAll: publicProcedure
    .output(PlatformStatsResponseSchema)
    .query(() => getPlatformStats()),
});
