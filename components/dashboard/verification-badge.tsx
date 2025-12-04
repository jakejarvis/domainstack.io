"use client";

import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
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
          "gap-1 border-amber-300 bg-amber-500/10 text-amber-600 dark:border-amber-600 dark:text-amber-400",
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
          "gap-1 border-success-border bg-success/10 text-success-foreground",
          className,
        )}
      >
        <CheckCircle className="size-3" />
        Verified
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-amber-300 text-amber-600 dark:border-amber-600 dark:text-amber-400",
        className,
      )}
    >
      <Clock className="size-3" />
      Pending
    </Badge>
  );
}
