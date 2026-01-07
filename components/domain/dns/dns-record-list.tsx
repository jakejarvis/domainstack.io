import { useMemo } from "react";
import { TtlBadge } from "@/components/domain/dns/ttl-badge";
import { KeyValue } from "@/components/domain/key-value";
import { Favicon } from "@/components/icons/favicon";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@/components/ui/responsive-tooltip";
import type { DnsRecord } from "@/lib/types";

export function DnsRecordList({
  records,
  type,
}: {
  records: DnsRecord[];
  type: DnsRecord["type"];
}) {
  const filtered = useMemo(() => {
    const arr = records.filter((r) => r.type === type);
    return arr;
  }, [records, type]);

  return (
    <>
      {filtered.map((r) => (
        <KeyValue
          key={`${type}-${r.value}${type === "MX" ? `-${r.priority ?? ""}` : ""}`}
          label={
            type === "MX" && r.priority != null
              ? `Priority ${r.priority}`
              : undefined
          }
          value={r.value}
          trailing={
            typeof r.ttl === "number" ? <TtlBadge ttl={r.ttl} /> : undefined
          }
          suffix={
            r.isCloudflare ? (
              <ResponsiveTooltip>
                <ResponsiveTooltipTrigger
                  nativeButton={false}
                  render={
                    <span>
                      <Favicon domain="cloudflare.com" size={16} />
                    </span>
                  }
                />
                <ResponsiveTooltipContent>
                  <p>Real IP is being concealed using Cloudflare.</p>
                </ResponsiveTooltipContent>
              </ResponsiveTooltip>
            ) : undefined
          }
        />
      ))}
    </>
  );
}
