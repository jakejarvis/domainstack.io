import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import { domainRouter } from "./routers/domain";
import { notificationsRouter } from "./routers/notifications";
import { providerRouter } from "./routers/provider";
import { registrarRouter } from "./routers/registrar";
import { trackingRouter } from "./routers/tracking";
import { userRouter } from "./routers/user";
import { createCallerFactory, createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  domain: domainRouter,
  notifications: notificationsRouter,
  provider: providerRouter,
  registrar: registrarRouter,
  tracking: trackingRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export const createCaller = createCallerFactory(appRouter);
