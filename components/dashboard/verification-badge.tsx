"use client";

import { differenceInDays } from "date-fns";
import { AlertTriangle, BadgeCheck, ClockFading } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  // Show failing state if verified but verification is failing
  if (verified && verificationStatus === "failing") {
    const daysRemaining = verificationFailedAt
      ? Math.max(
          0,
          VERIFICATION_GRACE_PERIOD_DAYS -
            differenceInDays(new Date(), verificationFailedAt),
        )
      : VERIFICATION_GRACE_PERIOD_DAYS;

    const badge = (
      <Badge
        asChild={!!onClick}
        className={cn(
          "select-none gap-1 border-danger-border bg-danger/20 py-1 font-semibold text-danger-foreground",
          onClick && "cursor-pointer transition-opacity hover:opacity-80",
          className,
        )}
      >
        {onClick ? (
          <button type="button" onClick={onClick}>
            <AlertTriangle className="size-3" />
            Failing
          </button>
        ) : (
          <>
            <AlertTriangle className="size-3" />
            Failing
          </>
        )}
      </Badge>
    );

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{badge}</span>
        </TooltipTrigger>
        <TooltipContent>
          {daysRemaining > 0 ? (
            <>
              {daysRemaining} {daysRemaining === 1 ? "day" : "days"} to fix
              verification
            </>
          ) : (
            <>Verification will be revoked soon</>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (verified) {
    const badge = (
      <Badge
        className={cn(
          "select-none gap-1 border-success-border bg-success/20 py-1 font-semibold text-success-foreground",
          className,
        )}
      >
        <BadgeCheck className="size-3" />
        Verified
      </Badge>
    );

    // Show tooltip with verification method if available
    if (verificationMethod) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-default">{badge}</span>
          </TooltipTrigger>
          <TooltipContent>
            Using {VERIFICATION_METHOD_LABELS[verificationMethod]}
          </TooltipContent>
        </Tooltip>
      );
    }

    return badge;
  }

  // Pending verification state
  const pendingBadge = (
    <Badge
      asChild={!!onClick}
      variant="outline"
      className={cn(
        "select-none gap-1 border-warning-border bg-warning/20 py-1 font-semibold text-warning-foreground",
        onClick && "cursor-pointer transition-opacity hover:opacity-80",
        className,
      )}
    >
      {onClick ? (
        <button type="button" onClick={onClick}>
          <ClockFading className="size-3" />
          Pending
        </button>
      ) : (
        <>
          <ClockFading className="size-3" />
          Pending
        </>
      )}
    </Badge>
  );

  // Show tooltip when clickable
  if (onClick) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{pendingBadge}</span>
        </TooltipTrigger>
        <TooltipContent>Complete verification</TooltipContent>
      </Tooltip>
    );
  }

  return pendingBadge;
}
