import { and, asc, count, eq, gt, inArray, isNotNull, isNull, notExists, or } from "drizzle-orm";

import { PLAN_QUOTAS, type PLANS } from "@domainstack/constants";
import type { BillingSubscriptionUpsert } from "@domainstack/types";

import { db, type Database } from "../client";
import { billingSubscriptions, userSubscriptions, users, userTrackedDomains } from "../schema";

/** Drizzle transaction handle (callback arg of `db.transaction`). */
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

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
 *
 * If no row exists (e.g. the best-effort signup insert in `createSubscription`
 * was lost to a transient DB error), this self-heals by lazily upserting a
 * free-tier row and returns the free default rather than throwing — callers
 * (addDomain, getSubscription, withProTier, …) must never 500 over a missing
 * billing row.
 */
export async function getUserSubscription(userId: string): Promise<UserSubscriptionData> {
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
    // Self-heal: create the missing free-tier row. onConflictDoNothing keeps
    // this safe under a race with createSubscription / another request.
    await db
      .insert(userSubscriptions)
      .values({ userId, tier: "free" })
      .onConflictDoNothing({ target: userSubscriptions.userId });

    return {
      userId,
      plan: "free",
      planQuota: PLAN_QUOTAS.free,
      endsAt: null,
    };
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
 *
 * @deprecated Entitlement is derived by {@link recomputeEntitlement}. Kept for
 * legacy callers; new code upserts a `billing_subscriptions` row instead.
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
 * @deprecated Entitlement is derived by {@link recomputeEntitlement}. Kept for
 * legacy callers; new code upserts a `billing_subscriptions` row instead.
 */
export async function setSubscriptionEndsAt(userId: string, endsAt: Date): Promise<void> {
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
 *
 * @deprecated Entitlement is derived by {@link recomputeEntitlement}. Kept for
 * legacy callers; new code upserts a `billing_subscriptions` row instead.
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
    .where(and(isNotNull(userSubscriptions.endsAt), gt(userSubscriptions.endsAt, now)));

  return rows.map((row) => row.userId);
}

/**
 * Get user IDs that are cached as `pro` but whose `billing_subscriptions` rows
 * no longer grant pro (i.e. a `recomputeEntitlement` would downgrade them).
 *
 * These users need a server-side downgrade reconciliation: normally a provider
 * revoke webhook downgrades them, but if that webhook is
 * delayed/dropped/misconfigured they would otherwise keep Pro indefinitely.
 * Multi-provider-safe: a user still active on another provider is excluded
 * because that provider's row satisfies the EXISTS. The reconcile workflow
 * re-checks the provider before actually downgrading.
 */
export async function getUserIdsPastDue(): Promise<string[]> {
  const now = new Date();

  const granting = db
    .select({ userId: billingSubscriptions.userId })
    .from(billingSubscriptions)
    .where(
      and(
        eq(billingSubscriptions.userId, userSubscriptions.userId),
        or(
          eq(billingSubscriptions.status, "active"),
          and(
            eq(billingSubscriptions.status, "canceling"),
            isNotNull(billingSubscriptions.currentPeriodEnd),
            gt(billingSubscriptions.currentPeriodEnd, now),
          ),
        ),
      ),
    );

  const rows = await db
    .select({ userId: userSubscriptions.userId })
    .from(userSubscriptions)
    .where(and(eq(userSubscriptions.tier, "pro"), notExists(granting)));

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
 * Archive the oldest active tracked domains beyond the free quota. Shared by
 * `downgradeToFree` and `recomputeEntitlement`. Returns the number archived.
 */
async function archiveExcessDomains(tx: Tx, userId: string): Promise<number> {
  const freeLimit = PLAN_QUOTAS.free;

  const [countResult] = await tx
    .select({ count: count() })
    .from(userTrackedDomains)
    .where(and(eq(userTrackedDomains.userId, userId), isNull(userTrackedDomains.archivedAt)));

  const activeCount = countResult?.count ?? 0;

  if (activeCount <= freeLimit) {
    return 0;
  }

  const toArchive = activeCount - freeLimit;

  const domainsToArchive = await tx
    .select({ id: userTrackedDomains.id })
    .from(userTrackedDomains)
    .where(and(eq(userTrackedDomains.userId, userId), isNull(userTrackedDomains.archivedAt)))
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
}

/**
 * Downgrade user from Pro to Free tier.
 *
 * @deprecated Entitlement is now derived by {@link recomputeEntitlement} from
 * `billing_subscriptions`. Kept for the legacy direct-downgrade path; new code
 * should upsert a billing row and call `recomputeEntitlement`.
 */
export async function downgradeToFree(userId: string): Promise<number> {
  return await db.transaction(async (tx) => {
    const updated = await tx
      .update(userSubscriptions)
      .set({ tier: "free", updatedAt: new Date() })
      .where(eq(userSubscriptions.userId, userId))
      .returning({ userId: userSubscriptions.userId });

    if (updated.length === 0) {
      await tx.insert(userSubscriptions).values({ userId, tier: "free" });
    }

    return await archiveExcessDomains(tx, userId);
  });
}

export interface RecomputeResult {
  /** Resulting cached tier. */
  plan: Plan;
  /** Resulting cached endsAt. */
  endsAt: Date | null;
  /** The cached row's entitlement state actually changed. */
  changed: boolean;
  /** A free→pro transition happened on this call. */
  upgraded: boolean;
  /** A pro→free transition happened on this call. */
  downgraded: boolean;
  /** Domains archived (only non-zero when `downgraded`). */
  archivedCount: number;
}

function sameInstant(a: Date | null, b: Date | null): boolean {
  if (a === null || b === null) return a === b;
  return a.getTime() === b.getTime();
}

/**
 * Derive the cached `userSubscriptions` row from ALL `billing_subscriptions`
 * rows for the user. This is the single function allowed to write
 * tier/endsAt/lastExpiryNotification. Idempotent; safe under concurrent
 * webhooks (the cache row is locked `FOR UPDATE` so interleaved recomputes
 * serialize and converge — recompute is a pure function of the current row
 * set).
 *
 * Rules:
 * - A row grants pro if `status="active"`, or `status="canceling"` with a
 *   future `currentPeriodEnd`. tier = pro iff ANY row grants (OR across
 *   providers — no single provider's revoke can downgrade a user still active
 *   on another).
 * - endsAt is non-null iff pro AND zero `active` rows AND ≥1 future-dated
 *   `canceling` row, in which case it is the latest such `currentPeriodEnd`.
 *   (An `active` row anywhere ⇒ endsAt null: nothing to warn about.)
 * - lastExpiryNotification is reset only when the cancellation cycle changes
 *   (endsAt cleared, or moved to a different instant); otherwise preserved so
 *   repeated recomputes never re-fire 7/3/1 reminders.
 * - The domain-archiving path runs only on a pro→free transition.
 */
export async function recomputeEntitlement(userId: string): Promise<RecomputeResult> {
  const now = new Date();

  return await db.transaction(async (tx) => {
    const [prev] = await tx
      .select({
        tier: userSubscriptions.tier,
        endsAt: userSubscriptions.endsAt,
        lastExpiryNotification: userSubscriptions.lastExpiryNotification,
      })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1)
      .for("update");

    const prevTier: Plan = prev?.tier ?? "free";
    const prevEndsAt: Date | null = prev?.endsAt ?? null;
    const prevMarker: number | null = prev?.lastExpiryNotification ?? null;

    const rows = await tx
      .select({
        status: billingSubscriptions.status,
        currentPeriodEnd: billingSubscriptions.currentPeriodEnd,
      })
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.userId, userId));

    let hasActive = false;
    const cancelingEnds: Date[] = [];
    for (const row of rows) {
      if (row.status === "active") {
        hasActive = true;
      } else if (
        row.status === "canceling" &&
        row.currentPeriodEnd !== null &&
        row.currentPeriodEnd.getTime() > now.getTime()
      ) {
        cancelingEnds.push(row.currentPeriodEnd);
      }
    }

    const nextTier: Plan = hasActive || cancelingEnds.length > 0 ? "pro" : "free";

    let nextEndsAt: Date | null = null;
    if (nextTier === "pro" && !hasActive && cancelingEnds.length > 0) {
      nextEndsAt = cancelingEnds.reduce((latest, d) =>
        d.getTime() > latest.getTime() ? d : latest,
      );
    }

    let nextMarker: number | null;
    if (nextEndsAt === null || prevEndsAt === null || !sameInstant(nextEndsAt, prevEndsAt)) {
      nextMarker = null;
    } else {
      nextMarker = prevMarker;
    }

    const updated = await tx
      .update(userSubscriptions)
      .set({
        tier: nextTier,
        endsAt: nextEndsAt,
        lastExpiryNotification: nextMarker,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.userId, userId))
      .returning({ userId: userSubscriptions.userId });

    if (updated.length === 0) {
      await tx
        .insert(userSubscriptions)
        .values({
          userId,
          tier: nextTier,
          endsAt: nextEndsAt,
          lastExpiryNotification: nextMarker,
        })
        .onConflictDoUpdate({
          target: userSubscriptions.userId,
          set: {
            tier: nextTier,
            endsAt: nextEndsAt,
            lastExpiryNotification: nextMarker,
            updatedAt: new Date(),
          },
        });
    }

    const upgraded = prevTier === "free" && nextTier === "pro";
    const downgraded = prevTier === "pro" && nextTier === "free";
    const archivedCount = downgraded ? await archiveExcessDomains(tx, userId) : 0;

    const changed =
      prevTier !== nextTier || !sameInstant(prevEndsAt, nextEndsAt) || prevMarker !== nextMarker;

    return { plan: nextTier, endsAt: nextEndsAt, changed, upgraded, downgraded, archivedCount };
  });
}

/**
 * Upsert a single provider's subscription row (keyed by provider+externalId)
 * then the caller is expected to call {@link recomputeEntitlement}. No
 * ordering guard in Phase 1: behavior parity with the prior Polar handlers is
 * provided by their existing reconcile-before-destructive guard.
 */
export async function upsertBillingSubscription(
  userId: string,
  input: BillingSubscriptionUpsert,
): Promise<void> {
  await db
    .insert(billingSubscriptions)
    .values({
      userId,
      provider: input.provider,
      providerSubscriptionId: input.providerSubscriptionId,
      externalId: input.externalId,
      productId: input.productId,
      status: input.status,
      currentPeriodEnd: input.currentPeriodEnd,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
    })
    .onConflictDoUpdate({
      target: [billingSubscriptions.provider, billingSubscriptions.externalId],
      set: {
        userId,
        providerSubscriptionId: input.providerSubscriptionId,
        productId: input.productId,
        status: input.status,
        currentPeriodEnd: input.currentPeriodEnd,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
        updatedAt: new Date(),
      },
    });
}
