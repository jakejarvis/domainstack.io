import { Skeleton } from "@/components/ui/skeleton";

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
      <Skeleton className="h-3 w-80" />
    </div>
  );
}
