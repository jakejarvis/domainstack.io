import { Spinner } from "@/components/ui/spinner";

export function HostingMapSkeleton() {
  return (
    <div className="flex h-[280px] w-full items-center justify-center rounded-2xl border border-black/10 bg-muted/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur supports-[backdrop-filter]:bg-background/40 dark:border-white/10">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Spinner />
        <span>Loading map...</span>
      </div>
    </div>
  );
}
