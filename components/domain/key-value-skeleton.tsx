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
    <div className="flex h-16 min-w-0 items-center justify-between gap-4 rounded-2xl border border-border/65 bg-background/40 px-4 py-3 backdrop-blur-lg dark:border-border/50">
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

export function KeyValueSkeletonList({
  count,
  widthClass = "w-[100px]",
  withLeading = false,
  withTrailing = false,
  withSuffix = false,
  keyPrefix = "kv-skel",
}: {
  count: number;
  widthClass?: string;
  withLeading?: boolean;
  withTrailing?: boolean;
  withSuffix?: boolean;
  keyPrefix?: string;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <KeyValueSkeleton
          key={`${keyPrefix}-${i + 1}`}
          widthClass={widthClass}
          withLeading={withLeading}
          withTrailing={withTrailing}
          withSuffix={withSuffix}
        />
      ))}
    </>
  );
}
