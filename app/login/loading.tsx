import { AnimatedBackground } from "@/components/auth/animated-background";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <AnimatedBackground />
      <Card
        className={cn(
          "w-full max-w-md overflow-hidden rounded-3xl",
          "border-black/10 bg-background/80 backdrop-blur-xl",
          "supports-[backdrop-filter]:bg-background/80 dark:border-white/10",
        )}
      >
        <div className="flex flex-col items-center px-6 py-8">
          {/* Logo skeleton - circular to match the logo shape */}
          <Skeleton className="mb-6 size-14 rounded-full" />

          {/* Title skeleton */}
          <Skeleton className="mb-2 h-7 w-56" />

          {/* Description skeleton - two lines centered */}
          <div className="mb-8 flex flex-col items-center gap-1.5">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>

          {/* Sign in button skeleton */}
          <Skeleton className="h-11 w-full rounded-md" />

          {/* Legal text skeleton - two short lines centered */}
          <div className="mt-6 flex flex-col items-center gap-1">
            <Skeleton className="h-3 w-44" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </Card>
    </div>
  );
}
