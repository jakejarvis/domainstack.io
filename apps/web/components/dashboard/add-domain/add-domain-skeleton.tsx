import { Skeleton } from "@domainstack/ui/skeleton";

export function AddDomainSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6">
        {/* Header */}
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        {/* Stepper skeleton */}
        <div className="flex items-center justify-between pt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
              {i < 3 && <Skeleton className="mx-2 h-px flex-1" />}
            </div>
          ))}
        </div>
        {/* Content area */}
        <div className="mt-6 min-h-[280px] space-y-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-64" />
        </div>
        {/* Footer */}
        <div className="mt-4 flex justify-end border-t pt-4">
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    </div>
  );
}
