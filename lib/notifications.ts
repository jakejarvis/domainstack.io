import {
  CERTIFICATE_EXPIRY_THRESHOLDS,
  CERTIFICATE_THRESHOLD_TO_TYPE,
  DOMAIN_EXPIRY_THRESHOLDS,
  DOMAIN_THRESHOLD_TO_TYPE,
  type NotificationType,
} from "@/lib/constants/notifications";

// Re-export for convenience
export type { NotificationType } from "@/lib/constants/notifications";

/**
 * Generate a stable idempotency key for Resend.
 * This ensures that if a step retries, Resend won't send duplicate emails.
 *
 * Format: `{trackedDomainId}:{notificationType}`
 */
export function generateIdempotencyKey(
  trackedDomainId: string,
  notificationType: NotificationType,
): string {
  return `${trackedDomainId}:${notificationType}`;
}

/**
 * Get the domain expiry notification type for a given number of days remaining.
 * Returns the most urgent (smallest) threshold that applies, or null if none.
 *
 * Example: daysRemaining=14 → returns "domain_expiry_14d" (not 30d)
 */
export function getDomainExpiryNotificationType(
  daysRemaining: number,
): NotificationType | null {
  // Sort ascending so we find the smallest (most urgent) threshold first
  const sortedThresholds = [...DOMAIN_EXPIRY_THRESHOLDS].sort((a, b) => a - b);
  for (const threshold of sortedThresholds) {
    if (daysRemaining <= threshold) {
      return DOMAIN_THRESHOLD_TO_TYPE[threshold];
    }
  }
  return null;
}

/**
 * Get the certificate expiry notification type for a given number of days remaining.
 * Returns the most urgent (smallest) threshold that applies, or null if none.
 *
 * Example: daysRemaining=7 → returns "certificate_expiry_7d" (not 14d)
 */
export function getCertificateExpiryNotificationType(
  daysRemaining: number,
): NotificationType | null {
  // Sort ascending so we find the smallest (most urgent) threshold first
  const sortedThresholds = [...CERTIFICATE_EXPIRY_THRESHOLDS].sort(
    (a, b) => a - b,
  );
  for (const threshold of sortedThresholds) {
    if (daysRemaining <= threshold) {
      return CERTIFICATE_THRESHOLD_TO_TYPE[threshold];
    }
  }
  return null;
}
