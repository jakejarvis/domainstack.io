import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { KeyValueSkeletonList } from "@/components/domain/key-value-skeleton";
import { ReportSectionSkeleton } from "@/components/domain/report-section-skeleton";
import { sections } from "@/lib/constants/sections";

export function HeadersSectionSkeleton() {
  return (
    <ReportSectionSkeleton {...sections.headers}>
      <KeyValueGrid colsDesktop={2}>
        <KeyValueSkeletonList count={12} widthClass="w-[180px]" withTrailing />
      </KeyValueGrid>
    </ReportSectionSkeleton>
  );
}
