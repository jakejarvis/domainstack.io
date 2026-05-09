import { createCallerFactory, createTRPCRouter } from "../trpc";
import { domainRouter } from "./domain";
import { notificationsRouter } from "./notifications";
import { providerRouter } from "./provider";
import { createRegistrarRouter, type RegistrarRouterDeps } from "./registrar";
import { createTrackingRouter, type TrackingRouterDeps } from "./tracking";
import { userRouter } from "./user";

export type AppRouterDeps = RegistrarRouterDeps & {
  tracking: TrackingRouterDeps;
};

export function createAppRouter(deps: AppRouterDeps) {
  return createTRPCRouter({
    domain: domainRouter,
    notifications: notificationsRouter,
    provider: providerRouter,
    registrar: createRegistrarRouter(deps),
    tracking: createTrackingRouter(deps.tracking),
    user: userRouter,
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

export function createCallerFactoryForAppRouter(router: AppRouter) {
  return createCallerFactory(router);
}
