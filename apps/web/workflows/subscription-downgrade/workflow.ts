export interface SubscriptionDowngradeWorkflowInput {
  userId: string;
}

export type SubscriptionDowngradeWorkflowResult =
  | { skipped: true; reason: string }
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
  if (state.hasActiveSubscription) {
    // User actually renewed; a missed uncanceled/active webhook left a stale
    // end date. Self-heal by clearing it instead of downgrading.
    await clearEndsAt(userId);
    return { downgraded: false, reason: "still_active" };
  }

  // Step 3: Genuinely expired with no active Polar subscription — downgrade.
  const archivedCount = await downgrade(userId);
  return { downgraded: true, archivedCount };
}

interface LocalSubscription {
  plan: "free" | "pro";
  endsAt: Date | null;
}

async function fetchLocalSubscription(userId: string): Promise<LocalSubscription> {
  "use step";

  const { getUserSubscription } = await import("@domainstack/db/queries");
  const sub = await getUserSubscription(userId);
  return { plan: sub.plan, endsAt: sub.endsAt };
}

async function fetchPolarState(userId: string) {
  "use step";

  const { getCustomerSubscriptionState } = await import("@domainstack/polar");
  return await getCustomerSubscriptionState(userId);
}

async function clearEndsAt(userId: string): Promise<void> {
  "use step";

  const { clearSubscriptionEndsAt } = await import("@domainstack/db/queries");
  await clearSubscriptionEndsAt(userId);
}

async function downgrade(userId: string): Promise<number> {
  "use step";

  const [{ clearSubscriptionEndsAt }, { handleDowngrade, sendSubscriptionExpiredEmail }] =
    await Promise.all([import("@domainstack/db/queries"), import("@domainstack/polar")]);

  const archivedCount = await handleDowngrade(userId);
  await clearSubscriptionEndsAt(userId);

  try {
    await sendSubscriptionExpiredEmail(userId, archivedCount);
  } catch {
    // Best-effort: don't fail the downgrade if the email send fails.
  }

  return archivedCount;
}
