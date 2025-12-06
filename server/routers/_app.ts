import { domainRouter } from "@/server/routers/domain";
import { trackingRouter } from "@/server/routers/tracking";
import { createTRPCRouter } from "@/trpc/init";

export const appRouter = createTRPCRouter({
  domain: domainRouter,
  tracking: trackingRouter,
});

export type AppRouter = typeof appRouter;
