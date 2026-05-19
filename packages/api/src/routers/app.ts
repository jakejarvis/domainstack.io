import { getNativeAppConfig } from "@domainstack/edge-config";

import { publicProcedure } from "../procedures";
import { createTRPCRouter } from "../trpc";

export const appRouter = createTRPCRouter({
  /**
   * Native app gating config (version floor, store URLs, optional copy) from
   * Edge Config, or null when no gate is active. Public so the native client
   * can evaluate the version gate at cold start, before auth.
   */
  getConfig: publicProcedure.query(() => getNativeAppConfig()),
});
