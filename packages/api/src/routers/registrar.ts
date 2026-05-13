import { z } from "zod";

import { publicProcedure } from "../procedures";
import { createTRPCRouter } from "../trpc";

export type RegistrarPricingResponse = Record<
  string,
  { registration?: string; renewal?: string; transfer?: string }
>;

export interface PricingProvider {
  name: string;
  enabled: boolean;
  fetchPricing: () => Promise<RegistrarPricingResponse>;
}

export type RegistrarRouterDeps = {
  pricingProviders: PricingProvider[];
};

export function createRegistrarRouter({ pricingProviders }: RegistrarRouterDeps) {
  return createTRPCRouter({
    /**
     * Fetch domain pricing for the given TLD from all providers.
     * Returns pricing from all providers that have data for this TLD.
     */
    getPricing: publicProcedure
      .input(z.object({ tld: z.string().min(1) }))
      .query(async ({ input }) => {
        const normalizedTld = (input.tld ?? "").trim().toLowerCase().replace(/^\./, "");
        if (!normalizedTld) return { success: false, data: { tld: null, providers: [] } };

        const results = await Promise.all(
          pricingProviders.flatMap((provider) =>
            provider.enabled
              ? [
                  (async () => {
                    try {
                      const payload = await provider.fetchPricing();
                      const price = payload[normalizedTld]?.registration;
                      return price ? { provider: provider.name, price } : null;
                    } catch {
                      return null;
                    }
                  })(),
                ]
              : [],
          ),
        );

        return {
          success: true,
          data: {
            tld: normalizedTld,
            providers: results.filter((r): r is NonNullable<typeof r> => r !== null),
          },
        };
      }),
  });
}
