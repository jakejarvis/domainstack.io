import z from "zod";
import { PricingResponseSchema } from "@/lib/schemas";
import { getPricing } from "@/server/services/pricing";
import { createTRPCRouter, publicProcedure } from "@/trpc/init";

export const registrarRouter = createTRPCRouter({
  getPricing: publicProcedure
    .input(z.object({ tld: z.string().min(1) }))
    .output(PricingResponseSchema)
    .query(({ input }) => getPricing(input.tld)),
});
