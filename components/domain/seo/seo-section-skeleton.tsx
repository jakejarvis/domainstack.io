import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { KeyValueSkeleton } from "@/components/domain/key-value-skeleton";
import { Section } from "@/components/domain/section";
import { SocialPreviewSkeletonLarge } from "@/components/domain/seo/social-preview-skeleton-large";
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
            <SocialPreviewSkeletonLarge />
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
            <Skeleton className="h-9 w-full rounded-md sm:flex-1" />
            <div className="flex h-9 w-full items-stretch gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
              <Skeleton className="h-9 rounded-md sm:w-20" />
              <Skeleton className="h-9 rounded-md sm:w-20" />
              <Skeleton className="h-9 rounded-md sm:w-20" />
            </div>
          </div>

          {/* Groups accordion skeleton */}
          <div className="space-y-2">
            {["g-0", "g-1", "g-2"].map((gid, gidx) => (
              <div key={gid}>
                {/* Group header */}
                <div className="flex w-full items-center justify-between rounded-md p-1.5 py-2">
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
                        className={`flex items-center gap-2 border-input border-t px-2.5 py-2.5 ${rid === 0 ? "border-t-0" : ""}`}
                      >
                        <Skeleton className="size-3.5 rounded-full" />
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
            <div className="mt-5 flex items-center gap-2 text-[11px] text-foreground/70 uppercase leading-none tracking-[0.08em] dark:text-foreground/80">
              Sitemaps
              <SubheadCountSkeleton />
            </div>
            <div className="flex flex-col gap-2.5">
              {["sm-0", "sm-1"].map((sid) => (
                <Skeleton key={sid} className="h-[18px] w-56" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
