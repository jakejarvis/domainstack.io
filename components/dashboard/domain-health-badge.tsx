"use client";

import { differenceInDays } from "date-fns";
import {
  Activity,
  AlertTriangle,
  CircleHelp,
  ClockFading,
  Siren,
} from "lucide-react";
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
  const { label, variant, colorClass, icon } = getStatusConfig(status);

  return (
    <Badge
      variant={variant}
      className={cn("select-none gap-1", colorClass, className)}
    >
      {icon}
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
  icon: React.ReactNode;
} {
  switch (status) {
    case "healthy":
      return {
        label: "Healthy",
        variant: "default",
        colorClass:
          "border-success-border bg-success/10 font-semibold text-success-foreground",
        icon: <Activity className="size-3" />,
      };
    case "warning":
      return {
        label: "Expiring Soon",
        variant: "default",
        colorClass:
          "border-amber-300 bg-amber-500/10 font-semibold text-amber-600 dark:border-amber-600 dark:text-amber-400",
        icon: <AlertTriangle className="size-3" />,
      };
    case "critical":
      return {
        label: "Critical",
        variant: "destructive",
        colorClass: "gap-1 font-semibold",
        icon: <Siren className="size-3" />,
      };
    case "pending":
      return {
        label: "Pending",
        variant: "outline",
        colorClass:
          "border-amber-300 font-semibold text-amber-600 dark:border-amber-600 dark:text-amber-400",
        icon: <ClockFading className="size-3" />,
      };
    case "unknown":
      return {
        label: "Unknown",
        variant: "secondary",
        colorClass: "font-semibold",
        icon: <CircleHelp className="size-3" />,
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
