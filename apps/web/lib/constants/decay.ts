// ===== Access Decay Configuration =====
// Decay tier thresholds control how aggressively we slow down revalidation
// for domains that haven't been accessed recently.

/**
 * Decay tier thresholds in days for fast-changing sections (TTL <= 6 hours).
 * Fast-changing sections: DNS, Certificates, Headers (6h)
 * Returns multipliers: 1x, 3x, 10x, 30x, then stop at 180 days.
 */
export const FAST_CHANGING_TIERS = [
  { days: 0, multiplier: 1 }, // 0-3 days: normal
  { days: 3, multiplier: 3 }, // 3-14 days: 3x slower
  { days: 14, multiplier: 10 }, // 14-60 days: 10x slower
  { days: 60, multiplier: 30 }, // 60-180 days: 30x slower
] as const;

/**
 * Decay tier thresholds in days for slow-changing sections (TTL > 6 hours).
 * Slow-changing sections: Registration, Hosting, SEO (24h)
 * Returns multipliers: 1x, 5x, 20x, 50x, then stop at 90 days.
 */
export const SLOW_CHANGING_TIERS = [
  { days: 0, multiplier: 1 }, // 0-3 days: normal
  { days: 3, multiplier: 5 }, // 3-14 days: 5x slower
  { days: 14, multiplier: 20 }, // 14-60 days: 20x slower
  { days: 60, multiplier: 50 }, // 60-90 days: 50x slower
] as const;
