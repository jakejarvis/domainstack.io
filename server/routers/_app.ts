import { domainRouter } from "@/server/routers/domain";
import { statsRouter } from "@/server/routers/stats";
import { trackingRouter } from "@/server/routers/tracking";
import { userRouter } from "@/server/routers/user";
import { createTRPCRouter } from "@/trpc/init";

export const appRouter = createTRPCRouter({
  domain: domainRouter,
  stats: statsRouter,
  tracking: trackingRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
