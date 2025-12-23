import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function LoginSkeleton() {
  return (
    <div className="flex flex-col items-center p-6">
      {/* Logo skeleton - circular to match the logo shape */}
      <Skeleton className="mb-6 size-14 rounded-md" />

      {/* Title skeleton */}
      <Skeleton className="mb-2 h-7 w-56" />

      {/* Description skeleton - two lines centered */}
      <Skeleton className="h-4 w-64" />

      {/* Sign in button skeleton */}
      <div className="my-6 flex flex-row flex-wrap items-center gap-3">
        <Skeleton className="h-10 w-[400px] rounded-md" />
        <Skeleton className="h-10 w-[400px] rounded-md" />
        <Skeleton className="h-10 w-[400px] rounded-md" />
        <Skeleton className="h-10 w-[400px] rounded-md" />
      </div>

      {/* Legal text skeleton - two short lines centered */}
      <Skeleton className="my-1 h-3 w-80" />
    </div>
  );
}

export function LoginSkeletonWithCard() {
  return (
    <Card
      className={cn(
        "w-full max-w-md overflow-hidden rounded-3xl py-2",
        // Frosted glass in both light + dark mode (with a bit more presence in light mode).
        "border-black/15 bg-background/75 shadow-2xl ring-1 ring-black/5 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60 dark:border-white/8 dark:bg-background/65 dark:ring-white/5 dark:supports-[backdrop-filter]:bg-background/55",
      )}
    >
      <LoginSkeleton />
    </Card>
  );
}
