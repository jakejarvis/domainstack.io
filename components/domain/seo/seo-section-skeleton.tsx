import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { KeyValueSkeleton } from "@/components/domain/key-value-skeleton";
import { Section } from "@/components/domain/section";
import { SubheadCountSkeleton } from "@/components/domain/subhead-count";
import { Skeleton } from "@/components/ui/skeleton";
import { sections } from "@/lib/sections-meta";

export function SeoSectionSkeleton() {
  return (
    <Section {...sections.seo} isLoading>
      <div className="space-y-4">
        {/* Meta Tags */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] text-foreground/70 uppercase leading-none tracking-[0.08em] dark:text-foreground/80">
            Meta Tags
            <SubheadCountSkeleton />
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
          <div className="text-[11px] text-foreground/70 uppercase tracking-[0.08em] dark:text-foreground/80">
            Open Graph
          </div>
          {/* Tabs row skeleton */}
          <div className="flex h-auto w-full flex-wrap gap-1 rounded-md border border-muted-foreground/15 p-1 md:justify-start">
            {["twitter", "facebook", "linkedin", "discord", "slack"].map(
              (id) => (
                <Skeleton
                  key={`og-tab-${id}`}
                  className="h-9 flex-1 basis-0 rounded-md"
                />
              ),
            )}
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
                <div className="mt-1.5">
                  <Skeleton className="h-5 w-3/4" />
                </div>
                <div className="mt-1">
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Robots summary skeleton */}
        <div className="space-y-4 rounded-xl">
          <div className="mt-5 flex items-center gap-2 text-[11px] text-foreground/70 uppercase leading-none tracking-[0.08em] dark:text-foreground/80">
            robots.txt
            <SubheadCountSkeleton />
          </div>

          {/* Filters row */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Skeleton className="h-9 w-full rounded-md" />
            <div className="h-9 w-full items-stretch gap-2 sm:flex sm:w-auto">
              <Skeleton className="h-9 w-full rounded-md sm:w-16" />
              <Skeleton className="h-9 w-full rounded-md sm:w-24" />
              <Skeleton className="h-9 w-full rounded-md sm:w-28" />
            </div>
          </div>

          {/* Groups accordion skeleton */}
          <div className="space-y-2">
            {["g-0", "g-1", "g-2"].map((gid) => (
              <div
                key={gid}
                className="rounded-lg border border-border/65 p-1.5"
              >
                <div className="flex w-full items-center justify-between p-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="size-3 rounded bg-muted" />
                    <Skeleton className="h-5 w-10 rounded" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex flex-col gap-1.5 py-2">
                  {["r-0", "r-1", "r-2"].map((rid) => (
                    <div
                      key={rid}
                      className="flex items-center gap-2 rounded-lg border border-input px-2.5 py-2"
                    >
                      <span className="inline-block size-1.5 rounded-full bg-accent" />
                      <Skeleton className="h-3 w-64" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Sitemaps */}
          <div className="space-y-3">
            <div className="mt-5 flex items-center gap-2 text-[11px] text-foreground/70 uppercase leading-none tracking-[0.08em] dark:text-foreground/80">
              Sitemaps
              <SubheadCountSkeleton />
            </div>
            <div className="flex flex-col gap-1.5">
              {["sm-0", "sm-1"].map((sid) => (
                <Skeleton key={sid} className="h-3 w-56" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
