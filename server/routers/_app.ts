import { domainRouter } from "@/server/routers/domain";
import { statsRouter } from "@/server/routers/stats";
import { trackingRouter } from "@/server/routers/tracking";
import { createTRPCRouter } from "@/trpc/init";

export const appRouter = createTRPCRouter({
  domain: domainRouter,
  stats: statsRouter,
  tracking: trackingRouter,
});

export type AppRouter = typeof appRouter;
