import { domainRouter } from "@/server/routers/domain";
import { monitoringRouter } from "@/server/routers/monitoring";
import { createTRPCRouter } from "@/trpc/init";

export const appRouter = createTRPCRouter({
  domain: domainRouter,
  monitoring: monitoringRouter,
});

export type AppRouter = typeof appRouter;
