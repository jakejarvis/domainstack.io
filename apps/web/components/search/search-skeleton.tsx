import { Skeleton } from "@domainstack/ui/skeleton";
import { cn } from "@domainstack/ui/utils";

export type SearchSkeletonVariant = "sm" | "lg";

export function SearchSkeleton({
  variant = "lg",
  className,
}: {
  variant?: SearchSkeletonVariant;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full flex-col gap-5", className)}>
      <div className="relative w-full flex-1">
        {/* Mirrors the InputGroup chrome SearchClient renders */}
        <div
          className={cn(
            "flex w-full items-center rounded-md border border-input shadow-xs dark:bg-input/30",
            variant === "lg" ? "h-12" : "h-10",
          )}
        >
          {/* Leading addon: `pl-3` around a size-4 search icon */}
          <div className="flex shrink-0 items-center pl-3">
            <Skeleton className="size-4" />
          </div>

          {/* Placeholder text, offset by the input's `pl-2` */}
          <div className="flex min-w-0 flex-1 items-center pl-2">
            <Skeleton className={cn("h-4", variant === "lg" ? "w-30" : "w-32")} />
          </div>

          {variant === "lg" ? (
            // Inspect button (h-8, `mx-1` inside a `pr-3 mr-[-0.45rem]` addon)
            <div className="flex shrink-0 items-center pr-2.5">
              <Skeleton className="h-8 w-[90px] rounded-md" />
            </div>
          ) : (
            // Keyboard shortcut hint, hidden below `sm` just like the real Kbd
            <div className="hidden shrink-0 items-center pr-[7px] sm:flex">
              <Skeleton className="h-5 w-9 rounded-[calc(var(--radius)-5px)]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
