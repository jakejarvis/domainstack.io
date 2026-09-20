import type { NotificationType } from "@domainstack/types";

import {
  checkAlreadySentStep,
  checkExpiryPreferencesStep,
  getThresholdNotificationType,
} from "../steps/notifications";

export type ExpirySkipResult =
  | {
      skipped: true;
      reason: "renewed";
      renewed: true;
      clearedCount: number;
    }
  | {
      skipped: true;
      reason: "no_threshold_met" | "notifications_disabled" | "already_sent";
    };

type ExpiryPreferences = Awaited<ReturnType<typeof checkExpiryPreferencesStep>>;

/**
 * Decides whether an expiry notification should be sent, shared by the domain
 * and certificate branches. Called inline from `expiryWorkflow`.
 *
 * `daysRemaining` must already be validated as finite and non-negative. Returns
 * the skip result to hand back, or the notification type and channels to send on.
 */
export async function evaluateExpiryNotification(params: {
  trackedDomainId: string;
  daysRemaining: number;
  thresholds: readonly number[];
  prefix: Parameters<typeof getThresholdNotificationType>[2];
  preferenceKey: Parameters<typeof checkExpiryPreferencesStep>[2];
  userId: string;
  muted: boolean;
  /** Clears earlier notifications for this expiry kind so they can re-send after a renewal. */
  clearRenewed: (trackedDomainId: string) => Promise<number>;
}): Promise<
  | ExpirySkipResult
  | { skipped: false; notificationType: NotificationType; prefs: ExpiryPreferences }
> {
  const { trackedDomainId, daysRemaining, thresholds } = params;

  // Detect renewal: expiry is now beyond our notification window, so clear
  // previous notifications so they can be re-sent when approaching expiry again.
  if (daysRemaining > Math.max(...thresholds)) {
    const cleared = await params.clearRenewed(trackedDomainId);
    return { skipped: true, reason: "renewed", renewed: true, clearedCount: cleared };
  }

  const notificationType = getThresholdNotificationType(daysRemaining, thresholds, params.prefix);
  if (!notificationType) {
    return { skipped: true, reason: "no_threshold_met" };
  }

  const prefs = await checkExpiryPreferencesStep(params.userId, params.muted, params.preferenceKey);
  if (!prefs.shouldSendEmail && !prefs.shouldSendInApp) {
    return { skipped: true, reason: "notifications_disabled" };
  }

  const alreadySent = await checkAlreadySentStep(trackedDomainId, notificationType);
  if (alreadySent) {
    return { skipped: true, reason: "already_sent" };
  }

  return { skipped: false, notificationType, prefs };
}
