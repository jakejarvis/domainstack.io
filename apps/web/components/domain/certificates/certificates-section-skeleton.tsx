import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { KeyValueSkeleton } from "@/components/domain/key-value-skeleton";
import { ReportSection } from "@/components/domain/report-section";
import { sections } from "@/lib/constants/sections";
import { Skeleton } from "@domainstack/ui/skeleton";

export function CertificatesSectionSkeleton() {
  return (
    <ReportSection isLoading {...sections.certificates}>
      <div className="relative overflow-hidden rounded-lg border bg-card/60 p-3 dark:bg-background/50 dark:**:data-[slot=key-value]:bg-card">
        <KeyValueGrid colsDesktop={2}>
          <KeyValueSkeleton label="Issuer" widthClass="w-[100px]" withLeading />
          <KeyValueSkeleton label="Subject" widthClass="w-[100px]" />
          <KeyValueSkeleton label="Valid from" widthClass="w-[120px]" withSuffix />
          <KeyValueSkeleton label="Valid to" widthClass="w-[120px]" withSuffix />
        </KeyValueGrid>
      </div>
      <div className="mt-4 flex justify-center">
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
    </ReportSection>
  );
}
