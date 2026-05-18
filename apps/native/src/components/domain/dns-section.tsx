import { useSuspenseQuery } from "@tanstack/react-query";
import { Fragment, useMemo } from "react";
import { View } from "react-native";

import { Badge } from "@/components/badge";
import { ReportSection } from "@/components/report-section";
import { Text } from "@/components/text";
import { useTRPC } from "@/lib/api";
import type { DnsRecord } from "@domainstack/types";

export function DnsSection({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.domain.getDnsRecords.queryOptions({ domain }));

  const groups = useMemo(() => groupByType(data.data?.records ?? []), [data.data?.records]);

  if (!data.success || groups.length === 0) {
    return (
      <ReportSection title="DNS">
        <Text className="text-sm text-muted-foreground">
          No DNS records were returned for this domain.
        </Text>
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
            <Text className="text-sm text-muted-foreground tabular-nums">
              {group.records.length}
            </Text>
          </View>
          <View className="gap-3">
            {group.records.map((record, recordIndex) => (
              <Fragment
                key={`${group.type}-${record.name}-${record.value}-${record.priority ?? "none"}`}
              >
                {recordIndex > 0 ? <View className="h-px bg-border" /> : null}
                <View className="gap-1">
                  <Text className="font-mono text-sm" selectable>
                    {record.value}
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {record.ttl != null ? (
                      <Text className="text-xs text-muted-foreground tabular-nums">
                        TTL {record.ttl}
                      </Text>
                    ) : null}
                    {record.priority != null ? (
                      <Text className="text-xs text-muted-foreground tabular-nums">
                        Priority {record.priority}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Fragment>
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
