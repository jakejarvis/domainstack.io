import { Spinner } from "@/components/ui/spinner";

export function HostingMapSkeleton() {
  return (
    <div className="flex h-[280px] w-full items-center justify-center rounded-2xl border border-border/65 bg-muted/50 backdrop-blur-lg dark:border-border/50">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Spinner />
        <span>Loading map...</span>
      </div>
    </div>
  );
}
