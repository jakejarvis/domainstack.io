import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { KeyValueSkeleton } from "@/components/domain/key-value-skeleton";
import { ReportSectionSkeleton } from "@/components/domain/report-section-skeleton";
import { sections } from "@/lib/constants/sections";

export function RegistrationSectionSkeleton() {
  return (
    <ReportSectionSkeleton {...sections.registration}>
      <KeyValueGrid colsDesktop={2}>
        <KeyValueSkeleton
          label="Registrar"
          withLeading
          widthClass="w-[120px]"
        />
        <KeyValueSkeleton label="Registrant" widthClass="w-[100px]" />
        <KeyValueSkeleton label="Created" widthClass="w-[120px]" />
        <KeyValueSkeleton label="Expires" widthClass="w-[120px]" />
      </KeyValueGrid>
    </ReportSectionSkeleton>
  );
}
