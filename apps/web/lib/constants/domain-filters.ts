import type { HealthFilter } from "@/lib/dashboard-utils";

/**
 * Domain filter constants for dashboard.
 * Types are in @/lib/types/domain-filters.ts.
 */

/** Filter options for domain health status */
export const HEALTH_OPTIONS: { value: HealthFilter; label: string }[] = [
  { value: "healthy", label: "Healthy" },
  { value: "expiring", label: "Expiring Soon" },
  { value: "expired", label: "Expired" },
];
