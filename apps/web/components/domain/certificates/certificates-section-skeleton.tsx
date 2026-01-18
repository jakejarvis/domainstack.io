import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { KeyValueSkeleton } from "@/components/domain/key-value-skeleton";
import { ReportSectionSkeleton } from "@/components/domain/report-section-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { sections } from "@/lib/constants/sections";

export function CertificatesSectionSkeleton() {
  return (
    <ReportSectionSkeleton {...sections.certificates}>
      <div className="relative overflow-hidden rounded-2xl border border-border/65 bg-background/40 p-3 backdrop-blur-lg dark:border-border/50">
        <KeyValueGrid colsDesktop={2}>
          <KeyValueSkeleton label="Issuer" widthClass="w-[100px]" withLeading />
          <KeyValueSkeleton label="Subject" widthClass="w-[100px]" />
          <KeyValueSkeleton label="Valid from" widthClass="w-[120px]" />
          <KeyValueSkeleton label="Valid to" widthClass="w-[120px]" />
        </KeyValueGrid>
      </div>
      <div className="mt-4 flex justify-center">
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
    </ReportSectionSkeleton>
  );
}
