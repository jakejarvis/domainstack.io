import { differenceInDays } from "date-fns";
import { AlertTriangle, BadgeCheck, ClockFading } from "lucide-react";
import { useEffect, useState } from "react";
import { BadgeWithTooltip } from "@/components/dashboard/badge-with-tooltip";
import {
  VERIFICATION_GRACE_PERIOD_DAYS,
  VERIFICATION_METHOD_LABELS,
} from "@/lib/constants/verification";
import type {
  VerificationMethod,
  VerificationStatusType,
} from "@/lib/db/repos/tracked-domains";
import { cn } from "@/lib/utils";

type VerificationBadgeProps = {
  verified: boolean;
  verificationStatus?: VerificationStatusType;
  verificationMethod?: VerificationMethod | null;
  verificationFailedAt?: Date | null;
  onClick?: () => void;
  className?: string;
};

export function VerificationBadge({
  verified,
  verificationStatus,
  verificationMethod,
  verificationFailedAt,
  onClick,
  className,
}: VerificationBadgeProps) {
  // Capture current time only on client after mount (not during SSR)
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

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
        icon={AlertTriangle}
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
        icon={BadgeCheck}
        label="Verified"
        className={cn(
          "border-success-border bg-success/20 text-success-foreground",
          className,
        )}
        tooltipContent={
          verificationMethod
            ? `Using ${VERIFICATION_METHOD_LABELS[verificationMethod]}`
            : undefined
        }
      />
    );
  }

  // Pending state
  return (
    <BadgeWithTooltip
      icon={ClockFading}
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
