/** Filter types for domain verification status */
export type StatusFilter = "verified" | "pending";

/** Filter types for domain health status */
export type HealthFilter = "healthy" | "expiring" | "expired";

/** Filter options for domain health status */
export const HEALTH_OPTIONS: { value: HealthFilter; label: string }[] = [
  { value: "healthy", label: "Healthy" },
  { value: "expiring", label: "Expiring Soon" },
  { value: "expired", label: "Expired" },
];
