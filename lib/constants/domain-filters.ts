/** Filter types for domain verification status */
export type StatusFilter = "verified" | "pending";

/** Filter types for domain health status */
export type HealthFilter = "healthy" | "expiring" | "expired";

/** Filter options for domain verification status */
export const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "verified", label: "Verified" },
  { value: "pending", label: "Pending Verification" },
];

/** Filter options for domain health status */
export const HEALTH_OPTIONS: { value: HealthFilter; label: string }[] = [
  { value: "healthy", label: "Healthy" },
  { value: "expiring", label: "Expiring Soon" },
  { value: "expired", label: "Expired" },
];
