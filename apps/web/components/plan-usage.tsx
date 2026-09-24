import { QuotaBar } from "@/components/dashboard/quota-bar";
import { cn } from "@domainstack/ui/utils";

export function PlanUsage({
  activeCount,
  planQuota,
  archivedCount,
  className,
}: {
  activeCount: number;
  planQuota: number;
  archivedCount: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium">Tracked domains</span>
        <span className="text-sm text-muted-foreground tabular-nums">
          <span className="text-xl font-semibold tracking-tight text-foreground">
            {activeCount}
          </span>{" "}
          / {planQuota}
        </span>
      </div>
      <QuotaBar used={activeCount} planQuota={planQuota} />
      {archivedCount > 0 ? (
        <p className="text-[13px] text-muted-foreground">
          <span className="tabular-nums">{archivedCount}</span> archived{" "}
          {archivedCount === 1 ? "domain doesn't" : "domains don't"} count toward this limit.
        </p>
      ) : null}
    </div>
  );
}
