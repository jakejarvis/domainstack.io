import {
  CERTIFICATE_EXPIRY_THRESHOLDS,
  CERTIFICATE_THRESHOLD_TO_TYPE,
  DOMAIN_EXPIRY_THRESHOLDS,
  DOMAIN_THRESHOLD_TO_TYPE,
} from "@domainstack/constants";
import type {
  CertificateExpiryThreshold,
  DomainExpiryThreshold,
  ExpiryNotificationPrefix,
  NotificationType,
} from "@domainstack/types";

import { checkAlreadySentStep, checkExpiryPreferencesStep } from "../steps/notifications";

function isDomainExpiryThreshold(value: number): value is DomainExpiryThreshold {
  return (DOMAIN_EXPIRY_THRESHOLDS as readonly number[]).includes(value);
}

function isCertificateExpiryThreshold(value: number): value is CertificateExpiryThreshold {
  return (CERTIFICATE_EXPIRY_THRESHOLDS as readonly number[]).includes(value);
}

function notificationTypeForThreshold(
  prefix: ExpiryNotificationPrefix,
  threshold: number,
): NotificationType | null {
  if (prefix === "domain_expiry") {
    return isDomainExpiryThreshold(threshold) ? DOMAIN_THRESHOLD_TO_TYPE[threshold] : null;
  }
  return isCertificateExpiryThreshold(threshold) ? CERTIFICATE_THRESHOLD_TO_TYPE[threshold] : null;
}

/**
 * Get the notification type for a given days remaining value and thresholds.
 *
 * Finds the smallest threshold that the days remaining falls under.
 * Thresholds that are not valid for `prefix` are ignored.
 * Returns null if days remaining exceeds all valid thresholds.
 *
 * @param daysRemaining - Number of days until expiration
 * @param thresholds - Array of threshold values (e.g., [30, 14, 7, 1])
 * @param prefix - Notification type prefix
 * @returns Notification type or null
 *
 * @example
 * ```ts
 * // Domain expiring in 5 days with thresholds [30, 14, 7, 1]
 * getThresholdNotificationType(5, [30, 14, 7, 1], "domain_expiry")
 * // Returns: "domain_expiry_7d"
 *
 * // Domain expiring in 45 days (exceeds all thresholds)
 * getThresholdNotificationType(45, [30, 14, 7, 1], "domain_expiry")
 * // Returns: null
 * ```
 */
export function getThresholdNotificationType(
  daysRemaining: number,
  thresholds: readonly number[],
  prefix: ExpiryNotificationPrefix,
): NotificationType | null {
  // NaN compares false against every threshold, which would otherwise fall
  // through to the smallest one and raise the most urgent notification.
  if (!Number.isFinite(daysRemaining)) return null;

  const sorted = [...thresholds].sort((a, b) => a - b);
  for (const threshold of sorted) {
    if (daysRemaining > threshold) continue;
    const notificationType = notificationTypeForThreshold(prefix, threshold);
    if (notificationType) return notificationType;
  }
  return null;
}

/**
 * Certificate thresholds worth alerting on for a certificate of this lifetime.
 *
 * Automated renewal (ACME clients, ARI) normally happens with about a third of
 * the lifetime left, so an alert before that point is noise: a 6-day
 * certificate is always "expiring in under 7 days". Thresholds at or above a
 * third of the lifetime are dropped; for a 90-day certificate that keeps all of
 * 14/7/3/1.
 */
export function certificateThresholdsForLifetime(
  validFrom: Date,
  validTo: Date,
  thresholds: readonly number[] = CERTIFICATE_EXPIRY_THRESHOLDS,
): number[] {
  const lifetimeDays = (validTo.getTime() - validFrom.getTime()) / 86_400_000;
  if (!Number.isFinite(lifetimeDays) || lifetimeDays <= 0) return [...thresholds];
  return thresholds.filter((t) => t < lifetimeDays / 3);
}

/**
 * Phrase for a floored day count (`calculateDaysRemaining`): 0 means under 24
 * hours left, 1 means 24-48 hours. Never "tomorrow" or "0 days".
 */
export function inDaysPhrase(days: number): string {
  if (days <= 0) return "within 24 hours";
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

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
  prefix: ExpiryNotificationPrefix;
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
