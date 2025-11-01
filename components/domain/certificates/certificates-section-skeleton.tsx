import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { KeyValueSkeleton } from "@/components/domain/key-value-skeleton";
import { Section } from "@/components/domain/section";
import { Skeleton } from "@/components/ui/skeleton";
import { sections } from "@/lib/sections-meta";

export function CertificatesSectionSkeleton() {
  return (
    <Section {...sections.certificates} isLoading>
      <div className="relative overflow-hidden rounded-2xl border border-black/5 bg-background/40 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur supports-[backdrop-filter]:bg-background/40 dark:border-white/5">
        <KeyValueGrid colsDesktop={2}>
          <KeyValueSkeleton label="Issuer" widthClass="w-[100px]" withLeading />
          <KeyValueSkeleton label="Subject" widthClass="w-[100px]" />
          <KeyValueSkeleton label="Valid from" widthClass="w-[100px]" />
          <KeyValueSkeleton
            label="Valid to"
            widthClass="w-[100px]"
            withSuffix
          />
        </KeyValueGrid>
      </div>
      <div className="my-2 flex justify-center">
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
    </Section>
  );
}
