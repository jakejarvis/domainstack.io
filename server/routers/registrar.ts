import z from "zod";
import { getPricing } from "@/lib/pricing";
import { createTRPCRouter, publicProcedure } from "@/trpc/init";

export const registrarRouter = createTRPCRouter({
  getPricing: publicProcedure
    .input(z.object({ tld: z.string().min(1) }))
    .query(({ input }) => getPricing(input.tld)),
});
