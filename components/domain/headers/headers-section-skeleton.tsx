import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { KeyValueSkeletonList } from "@/components/domain/key-value-skeleton";
import { ReportSection } from "@/components/domain/report-section";
import { sections } from "@/lib/constants/sections";

export function HeadersSectionSkeleton() {
  return (
    <ReportSection {...sections.headers} isLoading>
      <KeyValueGrid colsDesktop={2}>
        <KeyValueSkeletonList count={12} widthClass="w-[180px]" withTrailing />
      </KeyValueGrid>
    </ReportSection>
  );
}
