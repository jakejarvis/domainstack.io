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
  dns_txt: "TXT record",
  html_file: "file",
  meta_tag: "meta tag",
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
          "select-none gap-1 border-danger-border bg-danger/20 py-1 font-semibold text-danger-foreground",
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

  return (
    <Badge
      variant="outline"
      className={cn(
        "select-none gap-1 border-warning-border bg-warning/20 py-1 font-semibold text-warning-foreground",
        className,
      )}
    >
      <ClockFading className="size-3" />
      Pending
    </Badge>
  );
}
