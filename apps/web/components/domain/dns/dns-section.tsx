import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@domainstack/ui/empty";
import { IconWorld } from "@tabler/icons-react";
import { useMemo } from "react";
import { DnsGroup } from "@/components/domain/dns/dns-group";
import { DnsRecordList } from "@/components/domain/dns/dns-record-list";
import { ReportSection } from "@/components/domain/report-section";
import { sections } from "@/lib/constants/sections";
import type { DnsRecord, DnsRecordsResponse } from "@/lib/types/domain/dns";

export function DnsSection({
  data,
}: {
  domain?: string;
  data?: DnsRecordsResponse | null;
}) {
  const records = data?.records;
  const recordsByType = useMemo(() => {
    const byType: Record<DnsRecord["type"], DnsRecord[]> = {
      A: [],
      AAAA: [],
      MX: [],
      TXT: [],
      NS: [],
    };
    for (const r of records ?? []) {
      if (r.value !== "") {
        byType[r.type].push(r);
      }
    }
    return byType;
  }, [records]);

  return (
    <ReportSection {...sections.dns}>
      {records && records.length > 0 ? (
        <div className="space-y-4">
          <DnsGroup
            title="A Records"
            color="blue"
            count={recordsByType.A.length}
          >
            <DnsRecordList records={recordsByType.A} type="A" />
          </DnsGroup>
          <DnsGroup
            title="AAAA Records"
            color="cyan"
            count={recordsByType.AAAA.length}
          >
            <DnsRecordList records={recordsByType.AAAA} type="AAAA" />
          </DnsGroup>
          <DnsGroup
            title="MX Records"
            color="green"
            count={recordsByType.MX.length}
          >
            <DnsRecordList records={recordsByType.MX} type="MX" />
          </DnsGroup>
          <DnsGroup
            title="TXT Records"
            color="orange"
            count={recordsByType.TXT.length}
          >
            <DnsRecordList records={recordsByType.TXT} type="TXT" />
          </DnsGroup>
          <DnsGroup
            title="NS Records"
            color="purple"
            count={recordsByType.NS.length}
          >
            <DnsRecordList records={recordsByType.NS} type="NS" />
          </DnsGroup>
        </div>
      ) : (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconWorld />
            </EmptyMedia>
            <EmptyTitle>No DNS records found</EmptyTitle>
            <EmptyDescription>
              We couldn&apos;t resolve A/AAAA, MX, TXT, or NS records for this
              domain. If DNS was recently updated, it may take time to
              propagate.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </ReportSection>
  );
}
