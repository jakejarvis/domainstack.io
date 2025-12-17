"use client";

import { differenceInDays, formatDistanceToNowStrict } from "date-fns";
import { Activity, AlertTriangle, CircleHelp, Siren } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@/components/ui/responsive-tooltip";
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
  // Capture current time only on client after mount (not during SSR)
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  // During SSR (when now is null), show "Unknown" status without calculating
  const status = now
    ? getHealthStatus(expirationDate, verified, now)
    : "unknown";
  const { label, colorClass, icon } = getStatusConfig(status);

  const tooltipText = useMemo(() => {
    if (!expirationDate || !now) return null;
    const isExpired = expirationDate <= now;
    const relativeTime = formatDistanceToNowStrict(expirationDate, {
      addSuffix: true,
    });
    return `${isExpired ? "Expired" : "Expires"} ${relativeTime}`;
  }, [expirationDate, now]);

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
    <ResponsiveTooltip>
      <ResponsiveTooltipTrigger render={badge} />
      <ResponsiveTooltipContent>{tooltipText}</ResponsiveTooltipContent>
    </ResponsiveTooltip>
  );
}

function getHealthStatus(
  expirationDate: Date | null,
  verified: boolean,
  now: Date,
): HealthStatus {
  if (!verified || !expirationDate) {
    return "unknown";
  }

  const daysUntilExpiry = differenceInDays(expirationDate, now);

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
 * This should only be called from client components after hydration.
 * During SSR, it will return "slate" (unknown).
 */
export function getHealthAccent(
  expirationDate: Date | null,
  verified: boolean,
  now?: Date,
): "green" | "orange" | "red" | "slate" {
  // If no 'now' provided, return slate (unknown) to avoid Date.now() during SSR
  if (!now) return "slate";

  const status = getHealthStatus(expirationDate, verified, now);

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
