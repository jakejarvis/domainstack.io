import type { UserSubscriptionData } from "@domainstack/db/queries/user-subscription";

interface SubscriptionDowngradeWorkflowInput {
  userId: string;
}

type SubscriptionDowngradeWorkflowResult =
  | {
      skipped: true;
      reason: "not_pro" | "no_end_date" | "not_yet_due" | "polar_unverified" | "polar_pending";
    }
  | { downgraded: true; archivedCount: number }
  | { downgraded: false; reason: "still_active" };

/**
 * Durable workflow that downgrades a user whose paid period has elapsed.
 *
 * This is the server-side safety net for the Polar `subscription.revoked`
 * webhook: if that webhook is delayed/dropped/misconfigured a canceled user
 * would otherwise keep Pro indefinitely. We re-check the authoritative Polar
 * customer state before downgrading so we never downgrade a user who actually
 * renewed (and we self-heal a missed `uncanceled`/`active` by clearing the
 * stale end date).
 */
export async function subscriptionDowngradeWorkflow(
  input: SubscriptionDowngradeWorkflowInput,
): Promise<SubscriptionDowngradeWorkflowResult> {
  "use workflow";

  const { userId } = input;

  // Step 1: Re-read local state (guards against a race where the webhook
  // already downgraded, or the user renewed and endsAt was cleared).
  const local = await fetchLocalSubscription(userId);
  if (local.plan !== "pro") {
    return { skipped: true, reason: "not_pro" };
  }
  if (local.endsAt === null) {
    return { skipped: true, reason: "no_end_date" };
  }
  if (local.endsAt.getTime() > Date.now()) {
    return { skipped: true, reason: "not_yet_due" };
  }

  // Step 2: Reconcile against Polar's authoritative state.
  const state = await fetchPolarState(userId);
  if (state.status !== "ok") {
    // Couldn't verify — do nothing; the next cron run retries.
    return { skipped: true, reason: "polar_unverified" };
  }
  if (state.hasNonCancelingActive) {
    // User actually renewed; a missed uncanceled/active webhook left a stale
    // end date. Self-heal by clearing it instead of downgrading.
    await clearEndsAt(userId);
    return { downgraded: false, reason: "still_active" };
  }
  if (state.hasActiveSubscription) {
    // Only a canceling subscription remains and Polar hasn't ended it yet.
    // Keep endsAt so the next cron run re-checks instead of losing the backstop.
    return { skipped: true, reason: "polar_pending" };
  }

  // Step 3: Genuinely expired with no active Polar subscription — downgrade.
  const { archivedCount } = await downgrade(userId);
  return { downgraded: true, archivedCount };
}

type LocalSubscription = Pick<UserSubscriptionData, "plan" | "endsAt">;

async function fetchLocalSubscription(userId: string): Promise<LocalSubscription> {
  "use step";

  const { getUserSubscription } = await import("@domainstack/db/queries/user-subscription");
  const sub = await getUserSubscription(userId);
  return { plan: sub.plan, endsAt: sub.endsAt };
}

async function fetchPolarState(userId: string) {
  "use step";

  const { getCustomerSubscriptionState } = await import("@domainstack/polar/reconcile");
  return await getCustomerSubscriptionState(userId);
}

async function clearEndsAt(userId: string): Promise<void> {
  "use step";

  const { clearSubscriptionEndsAt } = await import("@domainstack/db/queries/user-subscription");
  await clearSubscriptionEndsAt(userId);
}

async function downgrade(userId: string): Promise<{ wasPro: boolean; archivedCount: number }> {
  "use step";

  const [{ downgradeToFree }, { sendSubscriptionExpiredEmail }] = await Promise.all([
    import("@domainstack/db/queries/user-subscription"),
    import("@domainstack/polar/emails"),
  ]);

  // Clears endsAt in the same transaction. A retry after the commit (or a
  // webhook that got there first) sees wasPro=false and sends nothing.
  const result = await downgradeToFree(userId);
  if (result.wasPro) {
    try {
      await sendSubscriptionExpiredEmail(userId, result.archivedCount);
    } catch {
      // Best-effort: don't fail the downgrade if the email send fails.
    }
  }

  return result;
}
