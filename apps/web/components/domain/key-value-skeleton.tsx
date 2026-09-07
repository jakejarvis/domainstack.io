import { Skeleton } from "@domainstack/ui/skeleton";
import { cn } from "@domainstack/ui/utils";

export function KeyValueSkeleton({
  label,
  withLeading = false,
  withTrailing = false,
  withSuffix = false,
  widthClass = "w-2/3",
  trailingClassName,
}: {
  label?: string;
  withLeading?: boolean;
  withTrailing?: boolean;
  withSuffix?: boolean;
  widthClass?: string;
  /** Override trailing placeholder. Defaults to CopyButton `size-icon-sm`. */
  trailingClassName?: string;
}) {
  return (
    <div className="flex h-16 min-w-0 items-center justify-between gap-4 rounded-xl border border-border bg-background/60 px-4 py-3 backdrop-blur-lg">
      <div className="flex min-w-0 flex-col space-y-1.5">
        {label ? (
          <div className="pt-1 text-[10px] leading-none tracking-[0.08em] text-foreground/75 uppercase dark:text-foreground/80">
            {label}
          </div>
        ) : null}
        <div className="inline-flex min-w-0 items-center gap-1.5">
          {withLeading && <Skeleton className="size-4 shrink-0 rounded" />}
          <Skeleton className={cn("h-4 shrink-0", widthClass)} />
          {withSuffix && <Skeleton className="h-3 w-15 shrink-0" />}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {withTrailing && <Skeleton className={cn("rounded-md", trailingClassName ?? "size-8")} />}
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
  trailingClassName,
  keyPrefix = "kv-skel",
}: {
  count: number;
  widthClass?: string;
  withLeading?: boolean;
  withTrailing?: boolean;
  withSuffix?: boolean;
  trailingClassName?: string;
  keyPrefix?: string;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => `${keyPrefix}-${i + 1}`).map((key) => (
        <KeyValueSkeleton
          key={key}
          widthClass={widthClass}
          withLeading={withLeading}
          withTrailing={withTrailing}
          withSuffix={withSuffix}
          trailingClassName={trailingClassName}
        />
      ))}
    </>
  );
}
