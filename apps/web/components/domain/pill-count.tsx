import { Skeleton } from "@domainstack/ui/skeleton";
import { cn } from "@/lib/utils";

type AccentColor =
  | "blue"
  | "cyan"
  | "green"
  | "orange"
  | "purple"
  | "indigo"
  | "slate";

function colorToClasses(color: AccentColor) {
  return color === "blue"
    ? "text-accent-blue bg-accent-blue/18"
    : color === "cyan"
      ? "text-accent-cyan bg-accent-cyan/18"
      : color === "green"
        ? "text-accent-green bg-accent-green/18"
        : color === "orange"
          ? "text-accent-orange bg-accent-orange/18"
          : color === "purple"
            ? "text-accent-purple bg-accent-purple/18"
            : color === "indigo"
              ? "text-accent-indigo bg-accent-indigo/18"
              : "text-accent-slate bg-accent-slate/18";
}

export function PillCount({
  count,
  color = "slate",
  className,
}: {
  count: number | string;
  color?: AccentColor;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono font-semibold text-[10px]",
        colorToClasses(color),
        className,
      )}
    >
      {count}
    </span>
  );
}

export function PillCountSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-5 w-6 rounded-full", className)} />;
}
