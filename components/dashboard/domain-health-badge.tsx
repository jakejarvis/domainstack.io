"use client";

import { differenceInDays, formatDistanceToNowStrict } from "date-fns";
import { Activity, AlertTriangle, CircleHelp, Siren } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

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
  const { label, colorClass, icon } = getStatusConfig(status);

  const tooltipText = expirationDate
    ? `${expirationDate > new Date() ? "Expires" : "Expired"} ${formatDistanceToNowStrict(expirationDate, { addSuffix: true })}`
    : null;

  const badge = (
    <Badge
      className={cn(
        "select-none gap-1 py-1 font-semibold",
        colorClass,
        className,
      )}
    >
      {icon}
      {label}
    </Badge>
  );

  if (!tooltipText) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  );
}

function getHealthStatus(
  expirationDate: Date | null,
  verified: boolean,
): HealthStatus {
  if (!verified || !expirationDate) {
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
  colorClass: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case "healthy":
      return {
        label: "Healthy",
        colorClass:
          "border-success-border bg-success/20 text-success-foreground",
        icon: <Activity className="size-3" />,
      };
    case "warning":
      return {
        label: "Needs Attention",
        colorClass:
          "border-warning-border bg-warning/20 text-warning-foreground",
        icon: <AlertTriangle className="size-3" />,
      };
    case "critical":
      return {
        label: "Needs Attention",
        colorClass: "border-danger-border bg-danger/20 text-danger-foreground",
        icon: <Siren className="size-3" />,
      };
    default:
      return {
        label: "Unknown",
        colorClass: "border-muted-border bg-muted/20 text-muted-foreground",
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
