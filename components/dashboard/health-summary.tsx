"use client";

import { AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EXPIRING_SOON_DAYS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type HealthSummaryProps = {
  expiringSoon: number;
  pendingVerification: number;
  onExpiringClick: () => void;
  onPendingClick: () => void;
};

export function HealthSummary({
  expiringSoon,
  pendingVerification,
  onExpiringClick,
  onPendingClick,
}: HealthSummaryProps) {
  // Don't render if no alerts
  if (expiringSoon === 0 && pendingVerification === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {expiringSoon > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={onExpiringClick}>
              <Badge
                variant="outline"
                className={cn(
                  "cursor-pointer border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 font-semibold text-amber-600 transition-colors hover:bg-amber-500/20 dark:text-amber-400",
                )}
              >
                <AlertTriangle className="mr-0.5 size-3.5" />
                <span className="tabular-nums">{expiringSoon}</span>
                <span>expiring soon</span>
              </Badge>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {expiringSoon} domain{expiringSoon === 1 ? "" : "s"} expiring within{" "}
            {EXPIRING_SOON_DAYS} days. Click to filter.
          </TooltipContent>
        </Tooltip>
      )}

      {pendingVerification > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={onPendingClick}>
              <Badge
                variant="outline"
                className={cn(
                  "cursor-pointer border-blue-500/30 bg-blue-500/10 px-2.5 py-1.5 font-semibold text-blue-600 transition-colors hover:bg-blue-500/20 dark:text-blue-400",
                )}
              >
                <Clock className="mr-0.5 size-3.5" />
                <span className="tabular-nums">{pendingVerification}</span>
                <span>pending verification</span>
              </Badge>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {pendingVerification} domain{pendingVerification === 1 ? "" : "s"}{" "}
            awaiting verification. Click to filter.
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
