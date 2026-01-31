/**
 * Expiry threshold utilities for notification scheduling.
 *
 * These pure functions handle the calculation of days remaining
 * and mapping to notification types based on configurable thresholds.
 */

/**
 * Notification type prefix for domain/certificate expiry notifications.
 */
export type ExpiryNotificationPrefix = "domain_expiry" | "certificate_expiry";

/**
 * Get the notification type for a given days remaining value and thresholds.
 *
 * Finds the smallest threshold that the days remaining falls under.
 * Returns null if days remaining exceeds all thresholds.
 *
 * @param daysRemaining - Number of days until expiration
 * @param thresholds - Array of threshold values (e.g., [30, 14, 7, 1])
 * @param prefix - Notification type prefix
 * @returns Notification type string or null
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
): string | null {
  const sorted = [...thresholds].sort((a, b) => a - b);
  for (const threshold of sorted) {
    if (daysRemaining <= threshold) {
      return `${prefix}_${threshold}d`;
    }
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
  const expDate =
    typeof expirationDate === "string"
      ? new Date(expirationDate)
      : expirationDate;

  const diffMs = expDate.getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
