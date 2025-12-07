"use client";

import { differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type HealthStatus = "healthy" | "warning" | "critical" | "pending" | "unknown";

type DomainHealthBadgeProps = {
  expirationDate: Date | null;
  verified: boolean;
  className?: string;
};

export function DomainHealthBadge({
  expirationDate,
  verified,
  className,
}: DomainHealthBadgeProps) {
  const status = getHealthStatus(expirationDate, verified);
  const { label, variant, colorClass } = getStatusConfig(status);

  return (
    <Badge
      variant={variant}
      className={cn("select-none", colorClass, className)}
    >
      {label}
    </Badge>
  );
}

function getHealthStatus(
  expirationDate: Date | null,
  verified: boolean,
): HealthStatus {
  if (!verified) {
    return "pending";
  }

  if (!expirationDate) {
    return "unknown";
  }

  const daysUntilExpiry = differenceInDays(expirationDate, new Date());

  if (daysUntilExpiry <= 7) {
    return "critical";
  }
  if (daysUntilExpiry <= 30) {
    return "warning";
  }
  return "healthy";
}

function getStatusConfig(status: HealthStatus): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  colorClass: string;
} {
  switch (status) {
    case "healthy":
      return {
        label: "Healthy",
        variant: "default",
        colorClass: "bg-success text-success-foreground border-success-border",
      };
    case "warning":
      return {
        label: "Expiring Soon",
        variant: "default",
        colorClass: "bg-warning text-warning-foreground border-warning-border",
      };
    case "critical":
      return {
        label: "Critical",
        variant: "destructive",
        colorClass: "",
      };
    case "pending":
      return {
        label: "Pending",
        variant: "outline",
        colorClass: "text-amber-600 border-amber-300 dark:text-amber-400",
      };
    case "unknown":
      return {
        label: "Unknown",
        variant: "secondary",
        colorClass: "",
      };
  }
}

/**
 * Get the accent color for a domain card based on health status.
 */
export function getHealthAccent(
  expirationDate: Date | null,
  verified: boolean,
): "green" | "orange" | "red" | "slate" {
  const status = getHealthStatus(expirationDate, verified);

  switch (status) {
    case "healthy":
      return "green";
    case "warning":
      return "orange";
    case "critical":
      return "red";
    default:
      return "slate";
  }
}
