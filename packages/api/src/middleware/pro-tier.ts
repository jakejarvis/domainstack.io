import { TRPCError } from "@trpc/server";
import { t } from "../trpc";

/**
 * Middleware to ensure user has Pro subscription.
 * Throws FORBIDDEN if user is on free tier.
 */
export const withProTier = t.middleware(async (opts) => {
  const { getUserSubscription } = await import("@domainstack/db/queries");

  // Ensure this middleware is chained after withAuth
  const user = opts.ctx.session?.user;
  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  const subscription = await getUserSubscription(user.id);

  if (subscription.plan !== "pro") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This feature requires a Pro subscription",
    });
  }

  return opts.next({
    ctx: {
      ...opts.ctx,
      user,
      subscription,
    },
  });
});
