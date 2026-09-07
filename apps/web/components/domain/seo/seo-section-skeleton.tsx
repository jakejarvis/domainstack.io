import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { KeyValueSkeleton } from "@/components/domain/key-value-skeleton";
import { PillCountSkeleton } from "@/components/domain/pill-count";
import { ReportSectionSkeleton } from "@/components/domain/report-section-skeleton";
import { sections } from "@/lib/constants/sections";
import { Skeleton } from "@domainstack/ui/skeleton";

export function SeoSectionSkeleton() {
  return (
    <ReportSectionSkeleton {...sections.seo}>
      <div className="space-y-4">
        {/* Meta Tags */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] leading-none tracking-[0.08em] text-foreground/70 uppercase dark:text-foreground/80">
            Meta Tags
            <PillCountSkeleton />
          </div>
          <KeyValueGrid colsDesktop={2}>
            <KeyValueSkeleton label="Title" widthClass="w-[220px]" />
            <KeyValueSkeleton label="Description" widthClass="w-[260px]" />
            <KeyValueSkeleton label="Canonical" widthClass="w-[200px]" />
            <KeyValueSkeleton label="Image" widthClass="w-[260px]" />
          </KeyValueGrid>
        </div>

        {/* Open Graph */}
        <div className="mt-6 space-y-3">
          <div className="text-[11px] tracking-[0.08em] text-foreground/70 uppercase dark:text-foreground/80">
            Open Graph
          </div>
          {/* Tabs row skeleton — TabsList is h-11 w-full with default variant chrome */}
          <div className="flex h-11 w-full items-center gap-1 rounded-lg border border-black/8 bg-muted/40 p-1 backdrop-blur-sm dark:border-white/10">
            {[1, 2, 3, 4, 5].map((id) => (
              <Skeleton key={`og-tab-${id}`} className="h-full flex-1 basis-0 rounded-md" />
            ))}
          </div>
          {/* Preview skeleton */}
          <div className="mx-auto mt-4 mb-2 w-full max-w-[480px] md:max-w-[640px]">
            <div className="overflow-hidden rounded-2xl border border-[#eff3f4] bg-white text-black dark:border-[#2f3336] dark:bg-black dark:text-white">
              <div className="relative w-full overflow-hidden bg-[#f1f5f9] dark:bg-[#0f1419]">
                <div className="aspect-[16/9] min-h-[160px] w-full">
                  <Skeleton className="h-full w-full rounded-none" />
                </div>
              </div>
              <div className="p-3">
                <Skeleton className="h-[11px] w-24" />
                <div className="mt-0.5">
                  <Skeleton className="h-[15px] w-3/4" />
                </div>
                <div className="mt-0.5">
                  <Skeleton className="h-[13px] w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Robots summary skeleton */}
        <div className="space-y-4 rounded-xl">
          <div className="mt-5 flex items-center gap-2 text-[11px] leading-none tracking-[0.08em] text-foreground/70 uppercase dark:text-foreground/80">
            robots.txt
            <PillCountSkeleton />
          </div>

          {/* Filters row */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Skeleton className="h-9 w-full rounded-md sm:flex-1" />
            <div className="flex h-9 w-full items-stretch gap-1 rounded-lg border border-black/8 bg-muted/50 p-1 sm:w-auto dark:border-white/10 [&>*]:flex-1 sm:[&>*]:flex-none">
              <Skeleton className="h-full rounded-md sm:w-[4.5rem]" />
              <Skeleton className="h-full rounded-md sm:w-[5.5rem]" />
              <Skeleton className="h-full rounded-md sm:w-[6.75rem]" />
            </div>
          </div>

          {/* Groups accordion skeleton */}
          <div className="space-y-2">
            {["g-0", "g-1", "g-2"].map((gid, gidx) => (
              <div key={gid}>
                {/* Group header */}
                <div className="flex w-full items-center justify-between rounded-md px-2 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Skeleton className="h-5 w-25 rounded" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
                {/* Rule rows skeleton - only show for first group */}
                {gidx === 0 && (
                  <div className="flex flex-col py-2">
                    {[0, 1, 2, 3, 4, 5].map((rid) => (
                      <div
                        key={`${gid}-rule-${rid}`}
                        className={`flex items-center gap-2 border-t border-muted px-2.5 py-2.5 ${rid === 0 ? "border-t-0" : ""}`}
                      >
                        <Skeleton className="size-4 rounded-full" />
                        <Skeleton className="h-3 w-32 rounded" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Sitemaps */}
          <div className="space-y-3">
            <div className="mt-5 flex items-center gap-2 text-[11px] leading-none tracking-[0.08em] text-foreground/70 uppercase dark:text-foreground/80">
              Sitemaps
              <PillCountSkeleton />
            </div>
            <div className="flex flex-col gap-2.5">
              {["sm-0", "sm-1"].map((sid) => (
                <Skeleton key={sid} className="h-[18px] w-56" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </ReportSectionSkeleton>
  );
}
