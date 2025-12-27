import { domainRouter } from "@/server/routers/domain";
import { notificationsRouter } from "@/server/routers/notifications";
import { providerRouter } from "@/server/routers/provider";
import { statsRouter } from "@/server/routers/stats";
import { trackingRouter } from "@/server/routers/tracking";
import { userRouter } from "@/server/routers/user";
import { createTRPCRouter } from "@/trpc/init";

export const appRouter = createTRPCRouter({
  domain: domainRouter,
  notifications: notificationsRouter,
  provider: providerRouter,
  stats: statsRouter,
  tracking: trackingRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
