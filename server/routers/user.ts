import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

export const userRouter = createTRPCRouter({
  /**
   * Get the user's linked OAuth accounts.
   * Returns only provider IDs for security (no tokens or sensitive data).
   */
  getLinkedAccounts: protectedProcedure.query(async ({ ctx }) => {
    const linkedAccounts = await db
      .select({
        providerId: accounts.providerId,
        createdAt: accounts.createdAt,
      })
      .from(accounts)
      .where(eq(accounts.userId, ctx.user.id));

    return linkedAccounts.map((account) => ({
      providerId: account.providerId,
      createdAt: account.createdAt,
    }));
  }),
});
