/**
 * RevenueCat webhook payload types.
 *
 * RevenueCat POSTs `{ api_version, event }` where `event.type` is one of the
 * lifecycle events below. Fields are intentionally permissive: RevenueCat adds
 * fields over time and the store-specific shape varies (App Store vs Play), so
 * the provider only depends on the small stable subset documented at
 * https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields.
 */

export type RevenueCatStore =
  | "APP_STORE"
  | "MAC_APP_STORE"
  | "PLAY_STORE"
  | "AMAZON"
  | "STRIPE"
  | "PROMOTIONAL"
  | "RC_BILLING"
  | "PADDLE";

export type RevenueCatEnvironment = "PRODUCTION" | "SANDBOX";

export type RevenueCatEventType =
  | "TEST"
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "CANCELLATION"
  | "UNCANCELLATION"
  | "NON_RENEWING_PURCHASE"
  | "SUBSCRIPTION_PAUSED"
  | "EXPIRATION"
  | "BILLING_ISSUE"
  | "PRODUCT_CHANGE"
  | "TRANSFER"
  | "SUBSCRIPTION_EXTENDED"
  | "TEMPORARY_ENTITLEMENT_GRANT"
  | "INVOICE_ISSUANCE"
  | "SUBSCRIBER_ALIAS";

/**
 * The inner `event` object. `app_user_id` is our user id because the native
 * client always calls `Purchases.logIn(userId)` before purchasing (no
 * anonymous purchases). TRANSFER events carry `transferred_from/to` instead.
 */
export interface RevenueCatEvent {
  type: RevenueCatEventType;
  id: string;
  app_user_id?: string | null;
  original_app_user_id?: string | null;
  aliases?: string[];
  product_id?: string | null;
  new_product_id?: string | null;
  period_type?: string | null;
  purchased_at_ms?: number | null;
  expiration_at_ms?: number | null;
  environment?: RevenueCatEnvironment | null;
  store?: RevenueCatStore | null;
  transaction_id?: string | null;
  original_transaction_id?: string | null;
  cancel_reason?: string | null;
  // Present only on TRANSFER events.
  transferred_from?: string[];
  transferred_to?: string[];
}

export interface RevenueCatWebhookBody {
  api_version?: string;
  event: RevenueCatEvent;
}
