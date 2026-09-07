import { Card } from "@domainstack/ui/card";
import { Skeleton } from "@domainstack/ui/skeleton";

/**
 * Inner add-domain flow skeleton. Matches `AddDomainContent` (no Card chrome)
 * so it can be used inside the page Card or the intercepting modal.
 */
export function AddDomainSkeleton() {
  return (
    <div>
      <div className="space-y-1">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-5 w-48" />
      </div>
      {/* StepperNav: mb-1 py-5, indicators only (labels are tooltips) */}
      <div className="mb-1 flex items-center py-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-1 items-center">
            <Skeleton className="size-8 rounded-full" />
            {i < 3 ? <Skeleton className="mx-2 h-px flex-1" /> : null}
          </div>
        ))}
      </div>
      {/* Step 1: min-h-[200px] with description + input, footer mt-6 */}
      <div className="flex min-h-[200px] flex-col justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
        <div className="mt-6 flex w-full items-center justify-end">
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/**
 * Full-page add-domain loading shell: back link + Card wrapping the flow.
 */
export function AddDomainPageSkeleton() {
  return (
    <div className="mx-auto my-auto flex w-full max-w-lg flex-col">
      <div className="mb-4 inline-flex items-center gap-1.5">
        <Skeleton className="size-4" />
        <Skeleton className="h-5 w-36" />
      </div>
      <Card className="w-full px-6">
        <AddDomainSkeleton />
      </Card>
    </div>
  );
}
