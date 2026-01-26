import { IconGift, IconRocket } from "@tabler/icons-react";
import { format } from "date-fns";
import { QuotaBar } from "@/components/dashboard/quota-bar";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

interface PlanStatusCardProps {
  activeCount: number;
  planQuota: number;
  isPro: boolean;
  /** Date when Pro subscription ends (if canceling) */
  endsAt?: Date | null;
  className?: string;
}

export function PlanStatusCard({
  activeCount,
  planQuota,
  isPro,
  endsAt,
  className,
}: PlanStatusCardProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border border-black/10 bg-muted/30 p-4 dark:border-white/10",
        className,
      )}
    >
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          {isPro ? (
            <IconRocket className="size-4 text-foreground/80" />
          ) : (
            <IconGift className="size-4 text-foreground/80" />
          )}
          <span className="font-medium">{isPro ? "Pro" : "Free"} Plan</span>
          <Badge
            className={cn(
              "py-[3px]",
              endsAt
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : isPro
                  ? "border-accent-gold/30 bg-accent-gold/10 text-accent-gold"
                  : "border-accent-blue/30 bg-accent-blue/10 text-accent-blue",
            )}
          >
            {endsAt ? `Ends ${format(endsAt, "MMM d")}` : "Active"}
          </Badge>
        </div>
        <p className="text-[13px] text-muted-foreground">
          {activeCount} of {planQuota} domains used
        </p>
      </div>
      <QuotaBar used={activeCount} planQuota={planQuota} className="w-24" />
    </div>
  );
}
