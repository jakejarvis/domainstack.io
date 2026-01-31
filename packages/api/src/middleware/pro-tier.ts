import { TRPCError } from "@trpc/server";
import { t } from "../trpc";

/**
 * Middleware to ensure user has Pro subscription.
 * Throws FORBIDDEN if user is on free tier.
 */
export const withProTier = t.middleware(async (opts) => {
  const { getUserSubscription } = await import("@domainstack/db/queries");

  // Type assertion needed because middleware chaining doesn't preserve extended context types
  const ctx = opts.ctx as typeof opts.ctx & { user: { id: string } };
  const subscription = await getUserSubscription(ctx.user.id);

  if (subscription.plan !== "pro") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This feature requires a Pro subscription",
    });
  }

  return opts.next({
    ctx: {
      ...ctx,
      subscription,
    },
  });
});
