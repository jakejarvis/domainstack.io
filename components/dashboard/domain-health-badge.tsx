import { differenceInDays, formatDistanceToNowStrict } from "date-fns";
import {
  Activity,
  AlertTriangle,
  CircleHelp,
  type LucideIcon,
  Siren,
} from "lucide-react";
import { useMemo } from "react";
import { BadgeWithTooltip } from "@/components/dashboard/badge-with-tooltip";
import { useHydratedNow } from "@/hooks/use-hydrated-now";
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
  // Use shared hydrated time to avoid N separate useEffect calls for N badges
  const now = useHydratedNow();

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

  return (
    <BadgeWithTooltip
      icon={icon}
      label={label}
      className={cn(colorClass, className)}
      tooltipContent={tooltipText ?? undefined}
    />
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
  icon: LucideIcon;
} {
  switch (status) {
    case "healthy":
      return {
        label: "Healthy",
        colorClass:
          "border-success-border bg-success/20 text-success-foreground",
        icon: Activity,
      };
    case "warning":
      return {
        label: "Needs Attention",
        colorClass:
          "border-warning-border bg-warning/20 text-warning-foreground",
        icon: AlertTriangle,
      };
    case "critical":
      return {
        label: "Needs Attention",
        colorClass: "border-danger-border bg-danger/20 text-danger-foreground",
        icon: Siren,
      };
    default:
      return {
        label: "Unknown",
        colorClass: "border-muted-border bg-muted/20 text-muted-foreground",
        icon: CircleHelp,
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
