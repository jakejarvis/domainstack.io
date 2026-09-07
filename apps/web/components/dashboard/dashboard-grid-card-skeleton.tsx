import { Skeleton } from "@domainstack/ui/skeleton";

type DashboardGridCardSkeletonProps = {
  /** Number of info rows to show. Default is 6 (Expires + 5 providers). */
  infoRows?: number;
};

export function DashboardGridCardSkeleton({ infoRows = 6 }: DashboardGridCardSkeletonProps) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-black/15 bg-background/60 py-0 shadow-2xl shadow-black/10 dark:border-white/15">
      {/* Header: favicon + domain name + badges + menu — matches CardHeader pt-6 pb-2 px-6 */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-md" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-32" />
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          </div>
          <Skeleton className="size-8 rounded-md" />
        </div>
      </div>
      {/* Info rows — matches CardContent pt-2 pb-6 and InfoRow chrome */}
      <div className="relative flex flex-1 flex-col px-6 pt-2 pb-6">
        <div className="space-y-2">
          {Array.from({ length: infoRows }, (_, i) => (
            <div
              key={`info-row-${i}`}
              className="flex items-center justify-between gap-3 rounded-xl border bg-background/40 px-3 py-2"
            >
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
