import { KeyValueSkeleton } from "@/components/domain/key-value-skeleton";
import { PillCountSkeleton } from "@/components/domain/pill-count";
import { ReportSection } from "@/components/domain/report-section";
import { sections } from "@/lib/constants/sections";

function DnsGroupSkeleton({
  title,
  records = 2,
}: {
  title: string;
  records?: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 leading-none">
        <div className="text-[11px] text-foreground/70 uppercase tracking-[0.08em] dark:text-foreground/80">
          {title}
        </div>
        <PillCountSkeleton />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {Array.from(
          { length: records },
          (_, n) => `dns-skel-${title}-${records}-${n}`,
        ).map((id) => (
          <KeyValueSkeleton key={id} withTrailing widthClass="w-[100px]" />
        ))}
      </div>
    </div>
  );
}

export function DnsSectionSkeleton() {
  return (
    <ReportSection {...sections.dns} isLoading>
      <div className="space-y-4">
        <DnsGroupSkeleton title="A Records" />
        <DnsGroupSkeleton title="AAAA Records" />
        <DnsGroupSkeleton title="MX Records" />
        <DnsGroupSkeleton title="TXT Records" records={4} />
        <DnsGroupSkeleton title="NS Records" />
      </div>
    </ReportSection>
  );
}
