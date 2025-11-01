import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { KeyValueSkeleton } from "@/components/domain/key-value-skeleton";
import { Section } from "@/components/domain/section";
import { Spinner } from "@/components/ui/spinner";
import { sections } from "@/lib/sections-meta";

export function HostingSectionSkeleton() {
  return (
    <Section {...sections.hosting} isLoading>
      <KeyValueGrid colsDesktop={3}>
        <KeyValueSkeleton label="DNS" withLeading widthClass="w-[100px]" />
        <KeyValueSkeleton label="Hosting" withLeading widthClass="w-[100px]" />
        <KeyValueSkeleton label="Email" withLeading widthClass="w-[100px]" />
      </KeyValueGrid>

      <KeyValueSkeleton label="Location" withLeading widthClass="w-[100px]" />

      {/* Map skeleton */}
      <div className="flex h-[280px] w-full items-center justify-center rounded-2xl border border-black/10 bg-muted/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur supports-[backdrop-filter]:bg-background/40 dark:border-white/10">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Spinner />
          <span>Loading map...</span>
        </div>
      </div>
    </Section>
  );
}
