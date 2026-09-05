import {
  IconAlertTriangle,
  IconProgressAlert,
  IconRosetteDiscountCheck,
  type TablerIcon,
} from "@tabler/icons-react";
import { differenceInDays } from "date-fns";

import { BadgeWithTooltip } from "@/components/dashboard/badge-with-tooltip";
import { useHydratedNow } from "@/hooks/use-hydrated-now";
import type { VerificationMethod, VerificationStatus } from "@domainstack/constants";
import { VERIFICATION_GRACE_PERIOD_DAYS } from "@domainstack/constants";
import { cn } from "@domainstack/ui/utils";

type DomainStatusBadgeProps = {
  verified: boolean;
  verificationStatus?: VerificationStatus;
  verificationMethod?: VerificationMethod | null;
  verificationFailedAt?: Date | null;
  onClick?: () => void;
  className?: string;
};

type DomainStatusBadgeConfig = {
  icon: TablerIcon;
  label: string;
  className: string;
  tooltipContent?: string;
  onClick?: () => void;
};

function getVerificationMethodLabel(method: VerificationMethod): string {
  if (method === "dns_txt") return "TXT record";
  if (method === "html_file") return "file";
  return "meta tag";
}

function getFailingTooltip(
  verificationFailedAt: Date | null | undefined,
  now: Date | null,
): string {
  const daysRemaining =
    verificationFailedAt && now
      ? Math.max(0, VERIFICATION_GRACE_PERIOD_DAYS - differenceInDays(now, verificationFailedAt))
      : VERIFICATION_GRACE_PERIOD_DAYS;

  if (daysRemaining > 0) {
    return `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} to fix verification`;
  }
  return "Verification will be revoked soon";
}

function getDomainStatusBadge({
  verified,
  verificationStatus,
  verificationMethod,
  verificationFailedAt,
  onClick,
  className,
  now,
}: DomainStatusBadgeProps & { now: Date | null }): DomainStatusBadgeConfig {
  if (verified && verificationStatus === "failing") {
    return {
      icon: IconAlertTriangle,
      label: "Failing",
      className: cn("border-danger-border bg-danger/20 text-danger-foreground", className),
      tooltipContent: getFailingTooltip(verificationFailedAt, now),
      onClick,
    };
  }

  if (verified) {
    return {
      icon: IconRosetteDiscountCheck,
      label: "Verified",
      className: cn("border-success-border bg-success/20 text-success-foreground", className),
      tooltipContent: verificationMethod
        ? `Using ${getVerificationMethodLabel(verificationMethod)}`
        : undefined,
    };
  }

  return {
    icon: IconProgressAlert,
    label: "Pending",
    className: cn("border-warning-border bg-warning/20 text-warning-foreground", className),
    tooltipContent: onClick ? "Complete verification" : undefined,
    onClick,
  };
}

export function DomainStatusBadge(props: DomainStatusBadgeProps) {
  const now = useHydratedNow();
  return <BadgeWithTooltip {...getDomainStatusBadge({ ...props, now })} />;
}
