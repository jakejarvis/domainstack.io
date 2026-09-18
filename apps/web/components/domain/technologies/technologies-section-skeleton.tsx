import { PillCountSkeleton } from "@/components/domain/pill-count";
import { ReportSection } from "@/components/domain/report-section";
import { sections } from "@/lib/constants/sections";
import { Skeleton } from "@domainstack/ui/skeleton";

function GroupSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] leading-none tracking-[0.08em] text-foreground/70 uppercase dark:text-foreground/80">
        <Skeleton className="h-3 w-24" />
        <PillCountSkeleton />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function TechnologiesSectionSkeleton() {
  return (
    <ReportSection isLoading {...sections.technologies}>
      <div className="space-y-4">
        <GroupSkeleton rows={3} />
        <GroupSkeleton rows={2} />
      </div>
    </ReportSection>
  );
}
