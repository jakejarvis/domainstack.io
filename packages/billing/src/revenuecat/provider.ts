import type { BillingProvider, NormalizedBillingEvent } from "@domainstack/types";

import { getRevenueCatCustomerState } from "./reconcile";
import type { RevenueCatEvent } from "./types";

const IGNORE: NormalizedBillingEvent = {
  userId: null,
  upsert: null,
  sideEffect: { kind: "none" },
};

function periodEndFrom(event: RevenueCatEvent): Date | null {
  if (event.expiration_at_ms == null) return null;
  const d = new Date(event.expiration_at_ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * RevenueCat implementation of the provider-agnostic billing seam.
 *
 * `normalizeEvent` is pure classification (no DB writes, no emails, no
 * network): the handler applies the reconcile-before-destructive guard and
 * then upserts + recomputes. TRANSFER is intentionally ignored here — it has
 * no single `app_user_id` and is fanned out across both ids by the handler.
 */
export const revenueCatProvider: BillingProvider<RevenueCatEvent> = {
  provider: "revenuecat",
  reconcile: getRevenueCatCustomerState,
  normalizeEvent(event: RevenueCatEvent): NormalizedBillingEvent {
    const userId = event.app_user_id ?? null;
    if (!userId) {
      return IGNORE;
    }

    const currentPeriodEnd = periodEndFrom(event);
    const base = {
      provider: "revenuecat" as const,
      externalId: userId,
      providerSubscriptionId: event.original_transaction_id ?? event.transaction_id ?? event.id,
      productId: event.new_product_id ?? event.product_id ?? null,
    };

    switch (event.type) {
      case "INITIAL_PURCHASE":
        return {
          userId,
          upsert: { ...base, status: "active", currentPeriodEnd, cancelAtPeriodEnd: false },
          sideEffect: { kind: "upgrade" },
        };
      case "RENEWAL":
      case "UNCANCELLATION":
      case "PRODUCT_CHANGE":
      case "SUBSCRIPTION_EXTENDED":
      case "TEMPORARY_ENTITLEMENT_GRANT":
        return {
          userId,
          upsert: { ...base, status: "active", currentPeriodEnd, cancelAtPeriodEnd: false },
          sideEffect: { kind: "none" },
        };
      case "NON_RENEWING_PURCHASE":
        // One-off (consumable/lifetime-ish): entitled now, will not renew.
        return {
          userId,
          upsert: { ...base, status: "active", currentPeriodEnd, cancelAtPeriodEnd: true },
          sideEffect: { kind: "none" },
        };
      case "CANCELLATION":
      case "SUBSCRIPTION_PAUSED":
        // Auto-renew turned off / paused: still entitled until the period end.
        return {
          userId,
          upsert: { ...base, status: "canceling", currentPeriodEnd, cancelAtPeriodEnd: true },
          sideEffect: currentPeriodEnd
            ? { kind: "canceling", periodEnd: currentPeriodEnd }
            : { kind: "none" },
        };
      case "EXPIRATION":
        return {
          userId,
          upsert: { ...base, status: "expired", currentPeriodEnd, cancelAtPeriodEnd: false },
          sideEffect: { kind: "expired" },
        };
      case "BILLING_ISSUE":
        // Grace period — RevenueCat keeps entitlement and sends EXPIRATION
        // later if it truly lapses. Never downgrade here.
        return IGNORE;
      case "TRANSFER":
      case "TEST":
      case "SUBSCRIBER_ALIAS":
      case "INVOICE_ISSUANCE":
        return IGNORE;
      // `event.type` comes off untyped JSON: an unknown/future RevenueCat
      // event must be ignored, not fall through to `undefined` (which would
      // crash the handler and make RevenueCat retry the event forever).
      default:
        return IGNORE;
    }
  },
};
