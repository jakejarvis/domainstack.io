import { Spinner } from "@/components/ui/spinner";

export function HostingMapSkeleton() {
  return (
    <div className="relative h-[280px] w-full rounded-2xl border border-border/65 bg-muted/20 backdrop-blur-lg dark:border-border/50">
      <div className="absolute inset-0 flex h-full w-full items-center justify-center">
        <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Spinner className="size-4" />
          Loading map...
        </div>
      </div>
    </div>
  );
}
