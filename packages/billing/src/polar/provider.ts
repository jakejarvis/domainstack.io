import type { WebhooksOptions } from "@polar-sh/better-auth";

import type { BillingProvider, NormalizedBillingEvent } from "@domainstack/types";

import { getCustomerSubscriptionState } from "./reconcile";

type SubscriptionCreatedPayload = Parameters<
  NonNullable<WebhooksOptions["onSubscriptionCreated"]>
>[0];
type SubscriptionActivePayload = Parameters<
  NonNullable<WebhooksOptions["onSubscriptionActive"]>
>[0];
type SubscriptionCanceledPayload = Parameters<
  NonNullable<WebhooksOptions["onSubscriptionCanceled"]>
>[0];
type SubscriptionRevokedPayload = Parameters<
  NonNullable<WebhooksOptions["onSubscriptionRevoked"]>
>[0];
type SubscriptionUncanceledPayload = Parameters<
  NonNullable<WebhooksOptions["onSubscriptionUncanceled"]>
>[0];

export type PolarSubscriptionEvent =
  | SubscriptionCreatedPayload
  | SubscriptionActivePayload
  | SubscriptionCanceledPayload
  | SubscriptionRevokedPayload
  | SubscriptionUncanceledPayload;

/**
 * Polar implementation of the provider-agnostic billing seam.
 *
 * `normalizeEvent` is pure classification (no DB writes, no emails): the
 * handlers apply the reconcile-before-destructive guard and then upsert +
 * recompute. `reconcile` is the existing live Polar customer-state lookup
 * (structurally identical to `BillingReconcileState`).
 */
export const polarProvider: BillingProvider<PolarSubscriptionEvent> = {
  provider: "polar",
  reconcile: getCustomerSubscriptionState,
  normalizeEvent(event: PolarSubscriptionEvent): NormalizedBillingEvent {
    const { data } = event;
    const userId = data.customer.externalId ?? null;
    const currentPeriodEnd = data.currentPeriodEnd ?? null;

    if (!userId || event.type === "subscription.created") {
      // No externalId, or payment unconfirmed — nothing to persist.
      return { userId, upsert: null, sideEffect: { kind: "none" } };
    }

    const base = {
      provider: "polar" as const,
      externalId: userId,
      providerSubscriptionId: data.id,
      productId: data.product.id ?? null,
    };

    switch (event.type) {
      case "subscription.active":
        return {
          userId,
          upsert: {
            ...base,
            status: "active",
            currentPeriodEnd,
            cancelAtPeriodEnd: false,
          },
          sideEffect: { kind: "upgrade" },
        };
      case "subscription.canceled":
        return {
          userId,
          upsert: {
            ...base,
            status: "canceling",
            currentPeriodEnd,
            cancelAtPeriodEnd: true,
          },
          sideEffect: currentPeriodEnd
            ? { kind: "canceling", periodEnd: currentPeriodEnd }
            : { kind: "none" },
        };
      case "subscription.revoked":
        return {
          userId,
          upsert: {
            ...base,
            status: "expired",
            currentPeriodEnd,
            cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
          },
          sideEffect: { kind: "expired" },
        };
      case "subscription.uncanceled":
        return {
          userId,
          upsert: {
            ...base,
            status: "active",
            currentPeriodEnd,
            cancelAtPeriodEnd: false,
          },
          sideEffect: { kind: "none" },
        };
    }
  },
};
