import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function KeyValueSkeleton({
  label,
  withLeading = false,
  withTrailing = false,
  withSuffix = false,
  widthClass = "w-2/3",
}: {
  label?: string;
  withLeading?: boolean;
  withTrailing?: boolean;
  withSuffix?: boolean;
  widthClass?: string;
}) {
  return (
    <div className="flex h-16 items-center justify-between gap-4 rounded-2xl border border-black/10 bg-background/40 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-lg dark:border-white/10">
      <div className="min-w-0 space-y-1">
        {label ? (
          <div className="text-[10px] text-foreground/75 uppercase tracking-[0.08em] dark:text-foreground/80">
            {label}
          </div>
        ) : null}
        <div className="flex w-full shrink-0 items-center gap-2">
          {withLeading && <Skeleton className="h-4 w-4 shrink-0 rounded" />}
          <Skeleton className={cn("h-4 shrink-0", widthClass)} />
          {withSuffix && <Skeleton className="h-3 w-10 shrink-0" />}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {withTrailing && <Skeleton className="h-5 w-12 rounded" />}
      </div>
    </div>
  );
}
