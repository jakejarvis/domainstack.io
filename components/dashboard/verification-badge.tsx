"use client";

import { AlertTriangle, BadgeCheck, ClockFading } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { VerificationStatusType } from "@/lib/db/repos/tracked-domains";
import { cn } from "@/lib/utils";

type VerificationBadgeProps = {
  verified: boolean;
  verificationStatus?: VerificationStatusType;
  className?: string;
};

export function VerificationBadge({
  verified,
  verificationStatus,
  className,
}: VerificationBadgeProps) {
  // Show failing state if verified but verification is failing
  if (verified && verificationStatus === "failing") {
    return (
      <Badge
        className={cn(
          "select-none gap-1 border-amber-300 bg-amber-500/10 font-semibold text-amber-600 dark:border-amber-600 dark:text-amber-400",
          className,
        )}
      >
        <AlertTriangle className="size-3" />
        Failing
      </Badge>
    );
  }

  if (verified) {
    return (
      <Badge
        className={cn(
          "select-none gap-1 border-success-border bg-success/10 font-semibold text-success-foreground",
          className,
        )}
      >
        <BadgeCheck className="size-3" />
        Verified
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "select-none gap-1 border-amber-300 font-semibold text-amber-600 dark:border-amber-600 dark:text-amber-400",
        className,
      )}
    >
      <ClockFading className="size-3" />
      Pending
    </Badge>
  );
}
