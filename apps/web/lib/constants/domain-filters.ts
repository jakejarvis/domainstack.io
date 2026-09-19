import { HEALTH_FILTERS, type HealthFilter } from "@/lib/dashboard-utils";

/**
 * Domain filter constants for dashboard.
 */

const HEALTH_LABELS: Record<HealthFilter, string> = {
  healthy: "Healthy",
  expiring: "Expiring Soon",
  expired: "Expired",
};

/** Filter options for domain health status */
export const HEALTH_OPTIONS = HEALTH_FILTERS.map((value) => ({
  value,
  label: HEALTH_LABELS[value],
}));
