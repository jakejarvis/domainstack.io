import { HostingMapSkeleton } from "@/components/domain/hosting/hosting-map-skeleton";
import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { KeyValueSkeleton } from "@/components/domain/key-value-skeleton";
import { ReportSectionSkeleton } from "@/components/domain/report-section-skeleton";
import { sections } from "@/lib/constants/sections";

export function HostingSectionSkeleton() {
  return (
    <ReportSectionSkeleton {...sections.hosting}>
      <KeyValueGrid colsDesktop={3}>
        <KeyValueSkeleton label="DNS" withLeading widthClass="w-[100px]" />
        <KeyValueSkeleton label="Hosting" withLeading widthClass="w-[100px]" />
        <KeyValueSkeleton label="Email" withLeading widthClass="w-[100px]" />
      </KeyValueGrid>

      <KeyValueSkeleton label="Location" withLeading widthClass="w-[220px]" />

      <HostingMapSkeleton />
    </ReportSectionSkeleton>
  );
}
