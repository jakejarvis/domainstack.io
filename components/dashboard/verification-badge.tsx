"use client";

import { AlertTriangle, BadgeCheck, ClockFading } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  VerificationMethod,
  VerificationStatusType,
} from "@/lib/db/repos/tracked-domains";
import { cn } from "@/lib/utils";

type VerificationBadgeProps = {
  verified: boolean;
  verificationStatus?: VerificationStatusType;
  verificationMethod?: VerificationMethod | null;
  className?: string;
};

const VERIFICATION_METHOD_LABELS: Record<
  NonNullable<VerificationMethod>,
  string
> = {
  dns_txt: "DNS TXT Record",
  html_file: "HTML File",
  meta_tag: "Meta Tag",
};

export function VerificationBadge({
  verified,
  verificationStatus,
  verificationMethod,
  className,
}: VerificationBadgeProps) {
  // Show failing state if verified but verification is failing
  if (verified && verificationStatus === "failing") {
    return (
      <Badge
        className={cn(
          "select-none gap-1 border-amber-300 bg-amber-500/10 py-1 font-semibold text-amber-600 dark:border-amber-600 dark:text-amber-400",
          className,
        )}
      >
        <AlertTriangle className="size-3" />
        Failing
      </Badge>
    );
  }

  if (verified) {
    const badge = (
      <Badge
        className={cn(
          "select-none gap-1 border-success-border bg-success/10 py-1 font-semibold text-success-foreground",
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
            Verified via {VERIFICATION_METHOD_LABELS[verificationMethod]}
          </TooltipContent>
        </Tooltip>
      );
    }

    return badge;
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "select-none gap-1 border-amber-300 py-1 font-semibold text-amber-600 dark:border-amber-600 dark:text-amber-400",
        className,
      )}
    >
      <ClockFading className="size-3" />
      Pending
    </Badge>
  );
}
