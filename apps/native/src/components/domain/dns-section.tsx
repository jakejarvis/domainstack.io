import { Trans, useLingui } from "@lingui/react/macro";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Fragment } from "react";
import { View } from "react-native";

import { ReportSection } from "@/components/report-section";
import { Text } from "@/components/text";
import { useTRPC } from "@/lib/api";
import { cn } from "@/lib/cn";

// Per-record-type colored mono chip — mirrors the web report's record palette.
const TYPE_CHIP: Record<string, string> = {
  A: "bg-accent-green/15 text-accent-green",
  AAAA: "bg-accent-cyan/15 text-accent-cyan",
  CNAME: "bg-accent-blue/15 text-accent-blue",
  MX: "bg-accent-orange/15 text-accent-orange",
  TXT: "bg-accent-pink/15 text-accent-pink",
  NS: "bg-accent-slate/15 text-accent-slate",
  SOA: "bg-accent-indigo/15 text-accent-indigo",
  SRV: "bg-accent-purple/15 text-accent-purple",
  CAA: "bg-accent-gold/15 text-accent-gold",
};
const TYPE_CHIP_FALLBACK = "bg-accent-slate/15 text-accent-slate";

function typeChip(type: string): string {
  return TYPE_CHIP[type.toUpperCase()] ?? TYPE_CHIP_FALLBACK;
}

export function DnsSection({ domain }: { domain: string }) {
  const { t } = useLingui();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.domain.getDnsRecords.queryOptions({ domain }));

  const records = data.data?.records ?? [];

  if (!data.success || records.length === 0) {
    return (
      <ReportSection
        accent="green"
        icon={{ android: "dns", ios: "point.3.connected.trianglepath.dotted" }}
        subtitle="A · AAAA · MX · TXT · NS"
        title={t`DNS`}
      >
        <Text className="text-sm text-muted-foreground">
          <Trans>No DNS records were returned for this domain.</Trans>
        </Text>
      </ReportSection>
    );
  }

  return (
    <ReportSection
      accent="green"
      count={records.length}
      icon={{ android: "dns", ios: "point.3.connected.trianglepath.dotted" }}
      subtitle="A · AAAA · MX · TXT · NS"
      title={t`DNS`}
    >
      <View>
        {records.map((record, index) => {
          const chip = typeChip(record.type);
          return (
            <Fragment
              key={`${record.type}-${record.name}-${record.value}-${record.priority ?? "none"}`}
            >
              <View
                className={cn(
                  "flex-row items-center gap-2 py-2.5",
                  index > 0 && "border-t border-dashed border-border",
                )}
              >
                <View
                  className={cn("rounded px-1.5 py-0.5", chip.split(" ")[0])}
                  style={{ borderCurve: "continuous" }}
                >
                  <Text className={cn("font-mono text-[11px] font-medium", chip.split(" ")[1])}>
                    {record.type}
                  </Text>
                </View>
                <Text className="min-w-0 flex-1 font-mono text-xs" numberOfLines={1} selectable>
                  {record.value}
                </Text>
                {record.priority != null ? (
                  <Text className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    P{record.priority}
                  </Text>
                ) : null}
                {record.ttl != null ? (
                  <Text className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {record.ttl}s
                  </Text>
                ) : null}
              </View>
            </Fragment>
          );
        })}
      </View>
    </ReportSection>
  );
}
