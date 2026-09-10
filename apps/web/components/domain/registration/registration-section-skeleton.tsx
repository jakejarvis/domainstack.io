import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { KeyValueSkeleton } from "@/components/domain/key-value-skeleton";
import { ReportSection } from "@/components/domain/report-section";
import { sections } from "@/lib/constants/sections";

export function RegistrationSectionSkeleton() {
  return (
    <ReportSection isLoading {...sections.registration}>
      <KeyValueGrid colsDesktop={2}>
        <KeyValueSkeleton label="Registrar" withLeading widthClass="w-[120px]" />
        <KeyValueSkeleton label="Registrant" widthClass="w-[100px]" />
        <KeyValueSkeleton label="Created" withSuffix widthClass="w-[90px]" />
        <KeyValueSkeleton label="Expires" withSuffix widthClass="w-[90px]" />
      </KeyValueGrid>
    </ReportSection>
  );
}
