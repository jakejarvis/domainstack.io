import { Spinner } from "@domainstack/ui/spinner";

export function HostingMapSkeleton() {
  return (
    <div className="relative h-[280px] w-full rounded-lg border bg-card/60">
      <div className="absolute inset-0 flex h-full w-full items-center justify-center">
        <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Spinner className="size-4" />
          Loading map…
        </div>
      </div>
    </div>
  );
}
