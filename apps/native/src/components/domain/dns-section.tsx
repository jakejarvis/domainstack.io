import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { View } from "react-native";

import { Badge } from "@/components/badge";
import { ReportSection } from "@/components/report-section";
import { MutedText, Text } from "@/components/text";
import { useTRPC } from "@/lib/api";
import type { DnsRecord } from "@domainstack/types";

export function DnsSection({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.domain.getDnsRecords.queryOptions({ domain }));

  const groups = useMemo(() => groupByType(data.data?.records ?? []), [data.data?.records]);

  if (!data.success || groups.length === 0) {
    return (
      <ReportSection title="DNS">
        <MutedText>No DNS records were returned for this domain.</MutedText>
      </ReportSection>
    );
  }

  return (
    <ReportSection title="DNS">
      {groups.map((group) => (
        <View className="gap-2" key={group.type}>
          <View className="flex-row items-center gap-2">
            <Badge>
              <Text className="font-semibold">{group.type}</Text>
            </Badge>
            <MutedText>{group.records.length}</MutedText>
          </View>
          <View className="gap-2">
            {group.records.map((record) => (
              <View
                className="border-line gap-1 rounded-lg border p-3"
                key={`${group.type}-${record.name}-${record.value}-${record.priority ?? "none"}`}
              >
                <Text className="font-mono text-sm" selectable>
                  {record.value}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {record.ttl != null ? (
                    <MutedText className="text-xs">TTL {record.ttl}</MutedText>
                  ) : null}
                  {record.priority != null ? (
                    <MutedText className="text-xs">Priority {record.priority}</MutedText>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ReportSection>
  );
}

function groupByType(records: DnsRecord[]) {
  const map = new Map<string, DnsRecord[]>();
  for (const record of records) {
    const list = map.get(record.type) ?? [];
    list.push(record);
    map.set(record.type, list);
  }
  return Array.from(map, ([type, recs]) => ({ type, records: recs }));
}
