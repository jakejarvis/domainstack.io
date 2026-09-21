import { and, asc, count, eq, gt, inArray, isNotNull, isNull, lt } from "drizzle-orm";

import { PLAN_QUOTAS } from "@domainstack/constants";
import type { Plan } from "@domainstack/types";

import { db } from "../client";
import { userSubscriptions, users, userTrackedDomains } from "../schema";
import { lockUserDomainQuota } from "./tracked-domains";

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

export interface DowngradeToFreeResult {
  /** True only when this call moved the user from pro to free. */
  wasPro: boolean;
  /** Tracked domains archived by this call to fit the free quota. */
  archivedCount: number;
}

async function selectUserSubscriptionRow(userId: string) {
  const [record] = await db
    .select({
      tier: userSubscriptions.tier,
      endsAt: userSubscriptions.endsAt,
    })
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId))
    .limit(1);

  return record ?? null;
}

/**
 * Get user's subscription data.
 *
 * If no row exists (e.g. the best-effort signup insert in `createSubscription`
 * was lost to a transient DB error), this self-heals by lazily upserting a
 * free-tier row and returns the free default rather than throwing — callers
 * (addDomain, getSubscription, withProTier, …) must never 500 over a missing
 * billing row.
 */
export async function getUserSubscription(userId: string): Promise<UserSubscriptionData> {
  const record = await selectUserSubscriptionRow(userId);

  if (!record) {
    // Self-heal: create the missing free-tier row. onConflictDoNothing keeps
    // this safe under a race with createSubscription / another request, but
    // a conflict means someone else's row won — re-read it instead of
    // assuming it's the free default this call tried to insert (it could be
    // a real "pro" row from a concurrent webhook/signup).
    const inserted = await db
      .insert(userSubscriptions)
      .values({ userId, tier: "free" })
      .onConflictDoNothing({ target: userSubscriptions.userId })
      .returning({ tier: userSubscriptions.tier, endsAt: userSubscriptions.endsAt });

    const row = inserted[0] ?? (await selectUserSubscriptionRow(userId));

    return {
      userId,
      plan: row?.tier ?? "free",
      planQuota: PLAN_QUOTAS[row?.tier ?? "free"],
      endsAt: row?.endsAt ?? null,
    };
  }

  return {
    userId,
    plan: record.tier,
    planQuota: PLAN_QUOTAS[record.tier],
    endsAt: record.endsAt,
  };
}

/**
 * Update user tier.
 */
export async function updateUserTier(userId: string, tier: Plan): Promise<void> {
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
 *
 * Pass `resetNotificationTracking: true` when this call establishes a new
 * cancellation cycle (a different end date than before) — it clears
 * `lastExpiryNotification` in the same update so the 7/3/1-day reminder
 * sequence can fire again for the new cycle. Leave it false for a
 * redelivered webhook carrying the same end date, or the reminders already
 * sent this cycle would be forgotten and re-sent.
 */
export async function setSubscriptionEndsAt(
  userId: string,
  endsAt: Date,
  options: { resetNotificationTracking?: boolean } = {},
): Promise<void> {
  const updated = await db
    .update(userSubscriptions)
    .set({
      endsAt,
      updatedAt: new Date(),
      ...(options.resetNotificationTracking ? { lastExpiryNotification: null } : {}),
    })
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
        eq(userSubscriptions.tier, "pro"),
        isNotNull(userSubscriptions.endsAt),
        gt(userSubscriptions.endsAt, now),
      ),
    );

  return rows.map((row) => row.userId);
}

/**
 * Get user IDs whose paid period has elapsed but are still on the pro tier.
 *
 * These users need a server-side downgrade reconciliation: normally the Polar
 * `subscription.revoked` webhook downgrades them, but if that webhook is
 * delayed/dropped/misconfigured they would otherwise keep Pro indefinitely.
 * The reconcile workflow re-checks Polar before actually downgrading.
 */
export async function getUserIdsPastDue(): Promise<string[]> {
  const now = new Date();

  const rows = await db
    .select({ userId: userSubscriptions.userId })
    .from(userSubscriptions)
    .where(
      and(
        eq(userSubscriptions.tier, "pro"),
        isNotNull(userSubscriptions.endsAt),
        lt(userSubscriptions.endsAt, now),
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
        eq(userSubscriptions.tier, "pro"),
        isNotNull(userSubscriptions.endsAt),
        gt(userSubscriptions.endsAt, now),
      ),
    )
    .limit(1);

  if (!row?.endsAt) {
    return null;
  }

  return {
    userId: row.userId,
    userName: row.userName,
    userEmail: row.userEmail,
    endsAt: row.endsAt,
    lastExpiryNotification: row.lastExpiryNotification,
  };
}

/**
 * Update the last expiry notification threshold sent.
 */
export async function setLastExpiryNotification(userId: string, threshold: number): Promise<void> {
  await db
    .update(userSubscriptions)
    .set({
      lastExpiryNotification: threshold,
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.userId, userId));
}

/**
 * Downgrade a user to free, clear their pending end date, and archive the
 * oldest domains over the free quota. Serialized with plan-limit checks via
 * the per-user quota lock. Safe to call repeatedly: `wasPro` is true only on
 * the call that performed the pro→free transition.
 */
export async function downgradeToFree(userId: string): Promise<DowngradeToFreeResult> {
  const freeLimit = PLAN_QUOTAS.free;

  return await db.transaction(async (tx) => {
    await lockUserDomainQuota(tx, userId);

    const [current] = await tx
      .select({ tier: userSubscriptions.tier })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .for("update")
      .limit(1);

    let wasPro = current?.tier === "pro";

    if (current) {
      await tx
        .update(userSubscriptions)
        .set({
          tier: "free",
          endsAt: null,
          lastExpiryNotification: null,
          updatedAt: new Date(),
        })
        .where(eq(userSubscriptions.userId, userId));
    } else {
      // The quota lock does not serialize inserts by updateUserTier or the
      // signup/self-heal paths. If another insert wins, lock and downgrade
      // its row too; the winner may have inserted a Pro subscription.
      const inserted = await tx
        .insert(userSubscriptions)
        .values({ userId, tier: "free" })
        .onConflictDoNothing({ target: userSubscriptions.userId })
        .returning({ userId: userSubscriptions.userId });

      if (inserted.length === 0) {
        const [winningRow] = await tx
          .select({ tier: userSubscriptions.tier })
          .from(userSubscriptions)
          .where(eq(userSubscriptions.userId, userId))
          .for("update")
          .limit(1);

        wasPro = winningRow?.tier === "pro";
        await tx
          .update(userSubscriptions)
          .set({
            tier: "free",
            endsAt: null,
            lastExpiryNotification: null,
            updatedAt: new Date(),
          })
          .where(eq(userSubscriptions.userId, userId));
      }
    }

    const [countResult] = await tx
      .select({ count: count() })
      .from(userTrackedDomains)
      .where(and(eq(userTrackedDomains.userId, userId), isNull(userTrackedDomains.archivedAt)));

    const activeCount = countResult?.count ?? 0;

    if (activeCount <= freeLimit) {
      return { wasPro, archivedCount: 0 };
    }

    const toArchive = activeCount - freeLimit;

    const domainsToArchive = await tx
      .select({ id: userTrackedDomains.id })
      .from(userTrackedDomains)
      .where(and(eq(userTrackedDomains.userId, userId), isNull(userTrackedDomains.archivedAt)))
      .orderBy(asc(userTrackedDomains.createdAt))
      .limit(toArchive);

    if (domainsToArchive.length === 0) {
      return { wasPro, archivedCount: 0 };
    }

    const idsToArchive = domainsToArchive.map((d) => d.id);

    const result = await tx
      .update(userTrackedDomains)
      .set({ archivedAt: new Date() })
      .where(inArray(userTrackedDomains.id, idsToArchive))
      .returning({ id: userTrackedDomains.id });

    return { wasPro, archivedCount: result.length };
  });
}
