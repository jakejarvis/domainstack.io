import { Card } from "@domainstack/ui/card";
import { Skeleton } from "@domainstack/ui/skeleton";
import { cn } from "@domainstack/ui/utils";

export function LoginSkeleton() {
  return (
    <div className="flex flex-col items-center">
      {/* Logo — Icon size="xl" is size-14 with mb-5 */}
      <Skeleton className="mb-5 size-14 rounded-md" />

      {/* Title — text-xl font-semibold tracking-tight */}
      <Skeleton className="mb-2 h-7 w-full max-w-56" />

      {/* Description — text-sm with mb-6 */}
      <Skeleton className="mb-6 h-5 w-full max-w-76" />

      {/* OAuth buttons — flex-col gap-3, size="lg" is h-10 */}
      <div className="flex w-full flex-col gap-3">
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>

      {/* Legal text — mt-6 text-xs leading-relaxed (two wrapped lines) */}
      <Skeleton className="mt-6 h-8 w-full max-w-82" />
    </div>
  );
}

export function LoginSkeletonWithCard() {
  return (
    <Card
      className={cn(
        "w-full max-w-md overflow-hidden rounded-xl px-6 py-8",
        // Frosted glass in both light + dark mode (with a bit more presence in light mode).
        "border-black/15 bg-background/70 shadow-2xl ring-1 ring-black/5 backdrop-blur-2xl dark:border-white/8 dark:bg-background/60 dark:ring-white/5",
      )}
    >
      <LoginSkeleton />
    </Card>
  );
}
