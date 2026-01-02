import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { KeyValueSkeleton } from "@/components/domain/key-value-skeleton";
import { ReportSection } from "@/components/domain/report-section";
import { Spinner } from "@/components/ui/spinner";
import { sections } from "@/lib/constants/sections";

export function HostingSectionSkeleton() {
  return (
    <ReportSection {...sections.hosting} isLoading>
      <KeyValueGrid colsDesktop={3}>
        <KeyValueSkeleton label="DNS" withLeading widthClass="w-[100px]" />
        <KeyValueSkeleton label="Hosting" withLeading widthClass="w-[100px]" />
        <KeyValueSkeleton label="Email" withLeading widthClass="w-[100px]" />
      </KeyValueGrid>

      <KeyValueSkeleton label="Location" withLeading widthClass="w-[220px]" />

      <div className="relative h-[280px] w-full rounded-2xl border border-border/65 bg-muted/20 backdrop-blur-lg dark:border-border/50">
        <div className="absolute inset-0 flex h-full w-full items-center justify-center">
          <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Spinner className="size-4" />
            Loading map...
          </div>
        </div>
      </div>
    </ReportSection>
  );
}
