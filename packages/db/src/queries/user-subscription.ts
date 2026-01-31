import { PLAN_QUOTAS, type PLANS } from "@domainstack/constants";
import {
  and,
  asc,
  count,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
} from "drizzle-orm";
import { db } from "../client";
import { userSubscriptions, users, userTrackedDomains } from "../schema";

/** Plan type derived from PLANS constant (single source of truth). */
type Plan = (typeof PLANS)[number];

export interface UserSubscriptionData {
  userId: string;
  plan: Plan;
  planQuota: number;
  endsAt: Date | null;
}

export interface UserWithEndingSubscription {
  userId: string;
  userName: string;
  userEmail: string;
  endsAt: Date;
  lastExpiryNotification: number | null;
}

/**
 * Get user's subscription data.
 */
export async function getUserSubscription(
  userId: string,
): Promise<UserSubscriptionData> {
  const [record] = await db
    .select({
      userId: userSubscriptions.userId,
      tier: userSubscriptions.tier,
      endsAt: userSubscriptions.endsAt,
    })
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId))
    .limit(1);

  if (!record) {
    throw new Error(`Subscription not found for user: ${userId}`);
  }

  const planQuota = PLAN_QUOTAS[record.tier];

  return {
    userId,
    plan: record.tier,
    planQuota,
    endsAt: record.endsAt,
  };
}

/**
 * Update user tier.
 */
export async function updateUserTier(
  userId: string,
  tier: Plan,
): Promise<void> {
  const updated = await db
    .update(userSubscriptions)
    .set({ tier, updatedAt: new Date() })
    .where(eq(userSubscriptions.userId, userId))
    .returning({ userId: userSubscriptions.userId });

  if (updated.length === 0) {
    await db
      .insert(userSubscriptions)
      .values({ userId, tier })
      .onConflictDoUpdate({
        target: userSubscriptions.userId,
        set: { tier, updatedAt: new Date() },
      });
  }
}

/**
 * Set subscription end date.
 */
export async function setSubscriptionEndsAt(
  userId: string,
  endsAt: Date,
): Promise<void> {
  const updated = await db
    .update(userSubscriptions)
    .set({ endsAt, updatedAt: new Date() })
    .where(eq(userSubscriptions.userId, userId))
    .returning({ userId: userSubscriptions.userId });

  if (updated.length === 0) {
    throw new Error(`Subscription not found for user: ${userId}`);
  }
}

/**
 * Clear subscription end date.
 */
export async function clearSubscriptionEndsAt(userId: string): Promise<void> {
  await db
    .update(userSubscriptions)
    .set({
      endsAt: null,
      lastExpiryNotification: null,
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.userId, userId));
}

/**
 * Create a subscription for a new user.
 */
export async function createSubscription(userId: string): Promise<void> {
  try {
    await db
      .insert(userSubscriptions)
      .values({ userId })
      .onConflictDoNothing({ target: userSubscriptions.userId });
  } catch {
    // Log but don't rethrow - user signup should not fail
  }
}

/**
 * Get user IDs with ending subscriptions.
 */
export async function getUserIdsWithEndingSubscriptions(): Promise<string[]> {
  const now = new Date();

  const rows = await db
    .select({ userId: userSubscriptions.userId })
    .from(userSubscriptions)
    .where(
      and(
        isNotNull(userSubscriptions.endsAt),
        gt(userSubscriptions.endsAt, now),
      ),
    );

  return rows.map((row) => row.userId);
}

/**
 * Get user details with ending subscription.
 */
export async function getUserWithEndingSubscription(
  userId: string,
): Promise<UserWithEndingSubscription | null> {
  const now = new Date();

  const [row] = await db
    .select({
      userId: userSubscriptions.userId,
      userName: users.name,
      userEmail: users.email,
      endsAt: userSubscriptions.endsAt,
      lastExpiryNotification: userSubscriptions.lastExpiryNotification,
    })
    .from(userSubscriptions)
    .innerJoin(users, eq(userSubscriptions.userId, users.id))
    .where(
      and(
        eq(userSubscriptions.userId, userId),
        isNotNull(userSubscriptions.endsAt),
        gt(userSubscriptions.endsAt, now),
      ),
    )
    .limit(1);

  if (!row || row.endsAt === null) {
    return null;
  }

  return row as UserWithEndingSubscription;
}

/**
 * Update the last expiry notification threshold sent.
 */
export async function setLastExpiryNotification(
  userId: string,
  threshold: number,
): Promise<void> {
  await db
    .update(userSubscriptions)
    .set({
      lastExpiryNotification: threshold,
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.userId, userId));
}

/**
 * Downgrade user from Pro to Free tier.
 */
export async function downgradeToFree(userId: string): Promise<number> {
  const freeLimit = PLAN_QUOTAS.free;

  return await db.transaction(async (tx) => {
    const updated = await tx
      .update(userSubscriptions)
      .set({ tier: "free", updatedAt: new Date() })
      .where(eq(userSubscriptions.userId, userId))
      .returning({ userId: userSubscriptions.userId });

    if (updated.length === 0) {
      await tx.insert(userSubscriptions).values({ userId, tier: "free" });
    }

    const [countResult] = await tx
      .select({ count: count() })
      .from(userTrackedDomains)
      .where(
        and(
          eq(userTrackedDomains.userId, userId),
          isNull(userTrackedDomains.archivedAt),
        ),
      );

    const activeCount = countResult?.count ?? 0;

    if (activeCount <= freeLimit) {
      return 0;
    }

    const toArchive = activeCount - freeLimit;

    const domainsToArchive = await tx
      .select({ id: userTrackedDomains.id })
      .from(userTrackedDomains)
      .where(
        and(
          eq(userTrackedDomains.userId, userId),
          isNull(userTrackedDomains.archivedAt),
        ),
      )
      .orderBy(asc(userTrackedDomains.createdAt))
      .limit(toArchive);

    if (domainsToArchive.length === 0) {
      return 0;
    }

    const idsToArchive = domainsToArchive.map((d) => d.id);

    const result = await tx
      .update(userTrackedDomains)
      .set({ archivedAt: new Date() })
      .where(inArray(userTrackedDomains.id, idsToArchive))
      .returning({ id: userTrackedDomains.id });

    return result.length;
  });
}
