import { logger } from "@domainstack/logger";
import type { BillingReconcileState } from "@domainstack/types";

const REVENUECAT_API_BASE = "https://api.revenuecat.com/v1";

interface RevenueCatEntitlement {
  expires_date: string | null;
}

interface RevenueCatSubscription {
  expires_date: string | null;
  unsubscribe_detected_at: string | null;
  billing_issues_detected_at: string | null;
}

interface RevenueCatSubscriberResponse {
  subscriber?: {
    entitlements?: Record<string, RevenueCatEntitlement>;
    subscriptions?: Record<string, RevenueCatSubscription>;
  };
}

function isFutureOrLifetime(expiresDate: string | null | undefined, now: number): boolean {
  if (expiresDate == null) return true;
  const ts = Date.parse(expiresDate);
  return Number.isFinite(ts) && ts > now;
}

/**
 * Live authoritative state for a RevenueCat customer, by `app_user_id`
 * (== our user id). Structurally identical to Polar's
 * `getCustomerSubscriptionState`: the destructive webhook handlers
 * (EXPIRATION / CANCELLATION) reconcile against this before downgrading so a
 * stale/duplicate event can't strip a re-subscribed user.
 *
 * `status: "unknown"` means the lookup itself failed (no API key, network, or
 * a non-2xx response). Callers MUST NOT perform a destructive action on
 * "unknown"; the subscription-expiry reconcile cron catches genuine lapses.
 */
export async function getRevenueCatCustomerState(userId: string): Promise<BillingReconcileState> {
  const apiKey = process.env.REVENUECAT_API_KEY;
  if (!apiKey) {
    // RevenueCat disabled on this server — nothing to reconcile against.
    return { status: "unknown" };
  }

  try {
    const res = await fetch(`${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(userId)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      logger.error(
        { userId, status: res.status },
        "RevenueCat subscriber lookup returned non-2xx during reconciliation",
      );
      return { status: "unknown" };
    }

    const body = (await res.json()) as RevenueCatSubscriberResponse;
    const now = Date.now();

    const entitlements = Object.values(body.subscriber?.entitlements ?? {});
    const hasActiveSubscription = entitlements.some((e) => isFutureOrLifetime(e.expires_date, now));

    const subscriptions = Object.values(body.subscriber?.subscriptions ?? {});
    const hasNonCancelingActive = subscriptions.some(
      (s) =>
        isFutureOrLifetime(s.expires_date, now) &&
        s.unsubscribe_detected_at == null &&
        s.billing_issues_detected_at == null,
    );

    return { status: "ok", hasActiveSubscription, hasNonCancelingActive };
  } catch (err) {
    logger.error({ err, userId }, "Failed to fetch RevenueCat customer state for reconciliation");
    return { status: "unknown" };
  }
}
