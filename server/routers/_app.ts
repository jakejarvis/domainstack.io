import { domainRouter } from "@/server/routers/domain";
import { notificationsRouter } from "@/server/routers/notifications";
import { providerRouter } from "@/server/routers/provider";
import { registrarRouter } from "@/server/routers/registrar";
import { trackingRouter } from "@/server/routers/tracking";
import { userRouter } from "@/server/routers/user";
import { createCallerFactory, createTRPCRouter } from "@/trpc/init";

export const appRouter = createTRPCRouter({
  domain: domainRouter,
  notifications: notificationsRouter,
  provider: providerRouter,
  registrar: registrarRouter,
  tracking: trackingRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
