import { describe, expect, it } from "vitest";

import type { NormalizedBillingEvent } from "@domainstack/types";

import { revenueCatProvider } from "./provider";
import type { RevenueCatEvent, RevenueCatEventType } from "./types";

// The BillingProvider interface types normalizeEvent as sync-or-async; this
// implementation is synchronous, so narrow it for terser assertions.
function normalize(e: RevenueCatEvent): NormalizedBillingEvent {
  return revenueCatProvider.normalizeEvent(e) as NormalizedBillingEvent;
}

function makeEvent(
  type: RevenueCatEventType,
  overrides: Partial<RevenueCatEvent> = {},
): RevenueCatEvent {
  return {
    type,
    id: "evt-1",
    app_user_id: "user-1",
    product_id: "io.domainstack.pro.monthly",
    original_transaction_id: "otxn-1",
    transaction_id: "txn-1",
    expiration_at_ms: Date.parse("2030-01-01T00:00:00Z"),
    environment: "PRODUCTION",
    store: "APP_STORE",
    ...overrides,
  };
}

describe("revenueCatProvider.normalizeEvent", () => {
  it("uses provider 'revenuecat' and app_user_id as externalId", () => {
    const r = normalize(makeEvent("INITIAL_PURCHASE"));
    expect(r.userId).toBe("user-1");
    expect(r.upsert).toMatchObject({
      provider: "revenuecat",
      externalId: "user-1",
      providerSubscriptionId: "otxn-1",
      productId: "io.domainstack.pro.monthly",
    });
  });

  it("falls back to transaction_id then event id for providerSubscriptionId", () => {
    expect(
      normalize(makeEvent("INITIAL_PURCHASE", { original_transaction_id: null })).upsert
        ?.providerSubscriptionId,
    ).toBe("txn-1");
    expect(
      normalize(
        makeEvent("INITIAL_PURCHASE", { original_transaction_id: null, transaction_id: null }),
      ).upsert?.providerSubscriptionId,
    ).toBe("evt-1");
  });

  it("INITIAL_PURCHASE → active + upgrade side effect", () => {
    const r = normalize(makeEvent("INITIAL_PURCHASE"));
    expect(r.upsert?.status).toBe("active");
    expect(r.upsert?.cancelAtPeriodEnd).toBe(false);
    expect(r.sideEffect).toEqual({ kind: "upgrade" });
  });

  it.each<RevenueCatEventType>([
    "RENEWAL",
    "UNCANCELLATION",
    "PRODUCT_CHANGE",
    "SUBSCRIPTION_EXTENDED",
    "TEMPORARY_ENTITLEMENT_GRANT",
  ])("%s → active + no side effect", (type) => {
    const r = normalize(makeEvent(type));
    expect(r.upsert?.status).toBe("active");
    expect(r.upsert?.cancelAtPeriodEnd).toBe(false);
    expect(r.sideEffect).toEqual({ kind: "none" });
  });

  it("PRODUCT_CHANGE prefers new_product_id", () => {
    const r = normalize(
      makeEvent("PRODUCT_CHANGE", { new_product_id: "io.domainstack.pro.yearly" }),
    );
    expect(r.upsert?.productId).toBe("io.domainstack.pro.yearly");
  });

  it("NON_RENEWING_PURCHASE → active but cancelAtPeriodEnd true", () => {
    const r = normalize(makeEvent("NON_RENEWING_PURCHASE"));
    expect(r.upsert?.status).toBe("active");
    expect(r.upsert?.cancelAtPeriodEnd).toBe(true);
    expect(r.sideEffect).toEqual({ kind: "none" });
  });

  it.each<RevenueCatEventType>(["CANCELLATION", "SUBSCRIPTION_PAUSED"])(
    "%s with future period end → canceling + canceling side effect",
    (type) => {
      const r = normalize(makeEvent(type));
      expect(r.upsert?.status).toBe("canceling");
      expect(r.upsert?.cancelAtPeriodEnd).toBe(true);
      expect(r.sideEffect.kind).toBe("canceling");
    },
  );

  it("CANCELLATION without an expiration → no canceling side effect", () => {
    const r = normalize(makeEvent("CANCELLATION", { expiration_at_ms: null }));
    expect(r.upsert?.status).toBe("canceling");
    expect(r.sideEffect).toEqual({ kind: "none" });
  });

  it("EXPIRATION → expired + expired side effect", () => {
    const r = normalize(makeEvent("EXPIRATION"));
    expect(r.upsert?.status).toBe("expired");
    expect(r.sideEffect).toEqual({ kind: "expired" });
  });

  it.each<RevenueCatEventType>([
    "BILLING_ISSUE",
    "TRANSFER",
    "TEST",
    "SUBSCRIBER_ALIAS",
    "INVOICE_ISSUANCE",
  ])("%s is ignored (no upsert)", (type) => {
    const r = normalize(makeEvent(type));
    expect(r.upsert).toBeNull();
    expect(r.sideEffect).toEqual({ kind: "none" });
  });

  it("ignores any event without app_user_id", () => {
    const r = normalize(makeEvent("INITIAL_PURCHASE", { app_user_id: null }));
    expect(r.userId).toBeNull();
    expect(r.upsert).toBeNull();
  });
});
