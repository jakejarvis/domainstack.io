import { z } from "zod";

import { providers } from "@/lib/pricing";
import { createTRPCRouter, publicProcedure, withRateLimit } from "@/trpc/init";

export const registrarRouter = createTRPCRouter({
  /**
   * Fetch domain pricing for the given TLD from all providers.
   * Returns pricing from all providers that have data for this TLD.
   */
  getPricing: publicProcedure
    .use(withRateLimit)
    .meta({ rateLimit: { requests: 20, window: "1 m" } })
    .input(z.object({ tld: z.string().min(1) }))
    .query(async ({ input }) => {
      const normalizedTld = (input.tld ?? "").trim().toLowerCase().replace(/^\./, "");
      if (!normalizedTld) return { success: false, data: { tld: null, providers: [] } };

      const fetches: Array<Promise<{ provider: string; price: string } | null>> = [];
      for (const provider of providers) {
        if (!provider.enabled) continue;
        fetches.push(
          (async () => {
            try {
              const payload = await provider.fetchPricing();
              const price = payload[normalizedTld]?.registration;
              return price ? { provider: provider.name, price } : null;
            } catch {
              return null;
            }
          })(),
        );
      }
      const results = await Promise.all(fetches);

      return {
        success: true,
        data: {
          tld: normalizedTld,
          providers: results.filter((r): r is NonNullable<typeof r> => r !== null),
        },
      };
    }),
});
