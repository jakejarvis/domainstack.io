import { getEnabledOAuthProviders } from "@domainstack/auth/oauth-config";

import { publicProcedure } from "../procedures";
import { createTRPCRouter } from "../trpc";

export const authRouter = createTRPCRouter({
  /**
   * OAuth providers configured server-side, in Domainstack display order.
   * Public so the sign-in screen and account-linking can render the right
   * buttons before the user is authenticated.
   */
  getOauthProviders: publicProcedure.query(() => getEnabledOAuthProviders()),
});
