/**
 * Expiry utilities for domain and certificate monitoring.
 *
 * This module provides pure functions for calculating days until expiration
 * and determining appropriate notification thresholds.
 */

export type { ExpiryNotificationPrefix } from "./threshold";
export {
  calculateDaysRemaining,
  getThresholdNotificationType,
} from "./threshold";
