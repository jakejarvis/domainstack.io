import { Card, CardContent, CardHeader } from "@domainstack/ui/card";
import { Skeleton } from "@domainstack/ui/skeleton";

type DashboardGridCardSkeletonProps = {
  /** Number of info rows to show. Default is 6 (Expires + 5 providers). */
  infoRows?: number;
};

export function DashboardGridCardSkeleton({ infoRows = 6 }: DashboardGridCardSkeletonProps) {
  return (
    <Card className="relative flex h-full flex-col overflow-hidden rounded-xl border border-black/15 bg-background/60 py-0 shadow-2xl shadow-black/10 dark:border-white/15">
      {/* Accent glow — slate is what DashboardGridCard renders before health is known */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-8 -top-8 h-24 accent-glow opacity-30 blur-2xl"
        style={{ "--glow-color": "var(--accent-slate)" } as React.CSSProperties}
      />

      {/* Header: favicon + domain name + badges + menu */}
      <CardHeader className="relative pt-6 pb-2">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1">
            {/* CardTitle `text-base` line box */}
            <Skeleton className="h-6 w-32" />
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {/* Health + status badges: 12px text, `py-1`, 1px border */}
              <Skeleton className="h-[22px] w-22 rounded-md" />
              <Skeleton className="h-[22px] w-20 rounded-md" />
            </div>
          </div>
          <Skeleton className="size-8 rounded-md" />
        </div>
      </CardHeader>

      {/* Info rows — mirrors InfoRow chrome */}
      <CardContent className="relative flex flex-1 flex-col pt-2 pb-6">
        <div className="space-y-2">
          {Array.from({ length: infoRows }, (_, i) => (
            <div
              key={`info-row-${i}`}
              className="flex items-center justify-between gap-3 rounded-xl border bg-background/40 px-3 py-2 text-[13px] leading-[1.2] backdrop-blur-lg"
            >
              {/* `h-[1lh]` reserves each side's real line box (12px label, 15.6px value) */}
              <div className="flex h-[1lh] items-center text-[10px] leading-[1.2]">
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="flex h-[1lh] items-center">
                <Skeleton className="h-3.5 w-24" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
