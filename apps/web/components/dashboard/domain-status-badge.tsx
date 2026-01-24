import {
  HourglassMediumIcon,
  SealCheckIcon,
  WarningIcon,
} from "@phosphor-icons/react/ssr";
import { differenceInDays } from "date-fns";
import { BadgeWithTooltip } from "@/components/dashboard/badge-with-tooltip";
import { useHydratedNow } from "@/hooks/use-hydrated-now";
import type {
  VerificationMethod,
  VerificationStatus,
} from "@/lib/constants/verification";
import { VERIFICATION_GRACE_PERIOD_DAYS } from "@/lib/constants/verification";
import { cn } from "@/lib/utils";

type DomainStatusBadgeProps = {
  verified: boolean;
  verificationStatus?: VerificationStatus;
  verificationMethod?: VerificationMethod | null;
  verificationFailedAt?: Date | null;
  onClick?: () => void;
  className?: string;
};

export function DomainStatusBadge({
  verified,
  verificationStatus,
  verificationMethod,
  verificationFailedAt,
  onClick,
  className,
}: DomainStatusBadgeProps) {
  // Use shared hydrated timestamp to avoid per-component state updates
  const now = useHydratedNow();

  // Failing state: verified but verification is failing
  if (verified && verificationStatus === "failing") {
    const daysRemaining =
      verificationFailedAt && now
        ? Math.max(
            0,
            VERIFICATION_GRACE_PERIOD_DAYS -
              differenceInDays(now, verificationFailedAt),
          )
        : VERIFICATION_GRACE_PERIOD_DAYS;

    const tooltipText =
      daysRemaining > 0
        ? `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} to fix verification`
        : "Verification will be revoked soon";

    return (
      <BadgeWithTooltip
        icon={WarningIcon}
        label="Failing"
        className={cn(
          "border-danger-border bg-danger/20 text-danger-foreground",
          className,
        )}
        tooltipContent={tooltipText}
        onClick={onClick}
      />
    );
  }

  // Verified state
  if (verified) {
    return (
      <BadgeWithTooltip
        icon={SealCheckIcon}
        label="Verified"
        className={cn(
          "border-success-border bg-success/20 text-success-foreground",
          className,
        )}
        tooltipContent={
          verificationMethod
            ? `Using ${verificationMethod === "dns_txt" ? "TXT record" : verificationMethod === "html_file" ? "file" : "meta tag"}`
            : undefined
        }
      />
    );
  }

  // Pending state
  return (
    <BadgeWithTooltip
      icon={HourglassMediumIcon}
      label="Pending"
      className={cn(
        "border-warning-border bg-warning/20 text-warning-foreground",
        className,
      )}
      tooltipContent={onClick ? "Complete verification" : undefined}
      onClick={onClick}
    />
  );
}
