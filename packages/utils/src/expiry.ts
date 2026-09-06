/**
 * Expiry threshold utilities for notification scheduling.
 *
 * These pure functions handle the calculation of days remaining
 * and mapping to notification types based on configurable thresholds.
 */

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
  const sorted = [...thresholds].sort((a, b) => a - b);
  for (const threshold of sorted) {
    if (daysRemaining > threshold) continue;
    const notificationType = notificationTypeForThreshold(prefix, threshold);
    if (notificationType) return notificationType;
  }
  return null;
}

/**
 * Calculate the number of days remaining until a given date.
 *
 * @param expirationDate - The expiration date
 * @param now - The current date (defaults to new Date())
 * @returns Number of days remaining (can be negative if expired)
 */
export function calculateDaysRemaining(
  expirationDate: Date | string,
  now: Date = new Date(),
): number {
  const expDate = typeof expirationDate === "string" ? new Date(expirationDate) : expirationDate;

  const diffMs = expDate.getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
