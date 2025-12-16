"use client";

import { differenceInDays } from "date-fns";
import { AlertTriangle, BadgeCheck, ClockFading } from "lucide-react";
import { useEffect, useState } from "react";
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
  // Capture current time only on client after mount (not during SSR)
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  // Show failing state if verified but verification is failing
  if (verified && verificationStatus === "failing") {
    const daysRemaining =
      verificationFailedAt && now
        ? Math.max(
            0,
            VERIFICATION_GRACE_PERIOD_DAYS -
              differenceInDays(now, verificationFailedAt),
          )
        : VERIFICATION_GRACE_PERIOD_DAYS;

    const badge = (
      <Badge
        className={cn(
          "select-none gap-1 border-danger-border bg-danger/20 py-1 font-semibold text-danger-foreground",
          onClick && "cursor-pointer transition-opacity hover:opacity-95",
          className,
        )}
        render={
          onClick ? <button type="button" onClick={onClick} /> : undefined
        }
      >
        <AlertTriangle className="size-3" />
        Failing
      </Badge>
    );

    return (
      <Tooltip>
        <TooltipTrigger nativeButton={false} render={<span>{badge}</span>} />
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
          <TooltipTrigger
            nativeButton={false}
            render={<span className="cursor-default">{badge}</span>}
          />
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
      variant="outline"
      className={cn(
        "select-none gap-1 border-warning-border bg-warning/20 py-1 font-semibold text-warning-foreground",
        onClick && "cursor-pointer transition-opacity hover:opacity-95",
        className,
      )}
      render={onClick ? <button type="button" onClick={onClick} /> : undefined}
    >
      <ClockFading className="size-3" />
      Pending
    </Badge>
  );

  // Show tooltip when clickable
  if (onClick) {
    return (
      <Tooltip>
        <TooltipTrigger
          nativeButton={false}
          render={<span>{pendingBadge}</span>}
        />
        <TooltipContent>Complete verification</TooltipContent>
      </Tooltip>
    );
  }

  return pendingBadge;
}
