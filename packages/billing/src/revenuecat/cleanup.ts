import { logger } from "@domainstack/logger";

const REVENUECAT_API_BASE = "https://api.revenuecat.com/v1";

/**
 * Best-effort removal of a RevenueCat subscriber on account deletion.
 *
 * NOTE: this only stops RevenueCat tracking. RevenueCat has no server-side
 * cancel — an active App Store / Play subscription keeps billing until the
 * user cancels it themselves in the store. Callers should surface that to the
 * user. Never throws (account deletion must not be blocked by this).
 */
export async function deleteRevenueCatSubscriber(userId: string): Promise<void> {
  const apiKey = process.env.REVENUECAT_API_KEY;
  if (!apiKey) return;

  try {
    const res = await fetch(`${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok && res.status !== 404) {
      logger.error({ userId, status: res.status }, "Failed to delete RevenueCat subscriber");
    }
  } catch (err) {
    logger.error({ err, userId }, "Failed to delete RevenueCat subscriber");
  }
}
