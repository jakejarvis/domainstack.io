import { HostingMapSkeleton } from "@/components/domain/hosting/hosting-map-skeleton";
import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { KeyValueSkeleton } from "@/components/domain/key-value-skeleton";
import { ReportSection } from "@/components/domain/report-section";
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

      <HostingMapSkeleton />
    </ReportSection>
  );
}
