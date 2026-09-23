import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { KeyValueSkeleton } from "@/components/domain/key-value-skeleton";
import { PillCountSkeleton } from "@/components/domain/pill-count";
import { ReportSection } from "@/components/domain/report-section";
import { sections } from "@/lib/constants/sections";
import { Skeleton } from "@domainstack/ui/skeleton";

export function SeoSectionSkeleton() {
  return (
    <ReportSection isLoading {...sections.seo}>
      <div className="space-y-4">
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

        <div className="mt-6 space-y-3">
          <div className="text-[11px] tracking-[0.08em] text-foreground/70 uppercase dark:text-foreground/80">
            Open Graph
          </div>
          {/* TabsList is h-11 w-full with default variant chrome */}
          <div className="flex h-11 w-full items-center gap-1 rounded-lg border bg-muted/40 p-1">
            {[1, 2, 3, 4, 5].map((id) => (
              <Skeleton key={`og-tab-${id}`} className="h-full flex-1 basis-0 rounded-md" />
            ))}
          </div>
          {/* a neutral card, not any one provider's chrome */}
          <div className="mx-auto mt-4 mb-2 w-full max-w-[480px] md:max-w-[640px]">
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="aspect-[16/9] min-h-[160px] w-full">
                <Skeleton className="h-full w-full rounded-none" />
              </div>
              <div className="space-y-1.5 p-3">
                {/* hostname / title / description line boxes shared by every provider preview */}
                <div className="flex h-[1lh] items-center text-[11px]">
                  <Skeleton className="h-[11px] w-24" />
                </div>
                <div className="flex h-[1lh] items-center text-[15px]">
                  <Skeleton className="h-[15px] w-3/4" />
                </div>
                <div className="flex h-[1lh] items-center text-[13px]">
                  <Skeleton className="h-[13px] w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-xl">
          <div className="mt-5 flex items-center gap-2 text-[11px] leading-none tracking-[0.08em] text-foreground/70 uppercase dark:text-foreground/80">
            robots.txt
            <PillCountSkeleton />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Skeleton className="h-9 w-full rounded-md sm:flex-1" />
            <div className="flex h-9 w-full items-stretch gap-1 rounded-lg border bg-muted/50 p-1 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
              <Skeleton className="h-full rounded-md sm:w-[4.5rem]" />
              <Skeleton className="h-full rounded-md sm:w-[5.5rem]" />
              <Skeleton className="h-full rounded-md sm:w-[6.75rem]" />
            </div>
          </div>

          <div className="space-y-2">
            {["g-0", "g-1", "g-2"].map((gid, gidx) => (
              <div key={gid}>
                <div className="flex w-full items-center justify-between rounded-md px-2 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Skeleton className="h-5 w-25 rounded" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
                {/* rule rows only for the first group */}
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
    </ReportSection>
  );
}
