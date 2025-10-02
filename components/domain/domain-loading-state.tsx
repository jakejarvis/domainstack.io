import { Section } from "@/components/domain/section";
import { Skeleton } from "@/components/ui/skeleton";
import { SECTION_DEFS, SECTION_ORDER } from "@/lib/sections-meta";

export function DomainLoadingState() {
  return (
    <div className="fade-in slide-in-from-bottom-2 animate-in space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>

      <div className="space-y-4">
        {SECTION_ORDER.map((key) => (
          <Section {...SECTION_DEFS[key]} key={key} isLoading />
        ))}
      </div>
    </div>
  );
}
