/**
 * Domain filter types for dashboard.
 *
 * Constants are in @/lib/constants/domain-filters.ts.
 */

/** Filter types for domain verification status */
export type StatusFilter = "verified" | "pending";

/** Filter types for domain health status */
export type HealthFilter = "healthy" | "expiring" | "expired";
