import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { Badge } from "@/components/badge";
import { KeyValueGrid, type KeyValueItem } from "@/components/key-value-grid";
import { ReportSection } from "@/components/report-section";
import { Text } from "@/components/text";
import { useTRPC } from "@/lib/api";
import type { Header } from "@domainstack/types";

const SECURITY_HEADERS = [
  "strict-transport-security",
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
] as const;

export function HeadersSection({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.domain.getHeaders.queryOptions({ domain }));

  const items = useMemo(() => buildItems(data.data?.headers ?? []), [data.data?.headers]);

  if (!data.success || !data.data) {
    return (
      <ReportSection
        accent="pink"
        icon={{ android: "list_alt", ios: "list.bullet.rectangle" }}
        subtitle="HTTP response"
        title="Headers"
      >
        <Text className="text-sm text-muted-foreground">Headers could not be retrieved.</Text>
      </ReportSection>
    );
  }

  const status = data.data.status;
  return (
    <ReportSection
      accent="pink"
      count={data.data.headers.length}
      icon={{ android: "list_alt", ios: "list.bullet.rectangle" }}
      subtitle="HTTP response"
      title="Headers"
      trailing={
        <Badge variant={status >= 200 && status < 400 ? "success" : "warning"}>
          <Text className="text-xs font-semibold">HTTP {status}</Text>
        </Badge>
      }
    >
      <KeyValueGrid items={items} />
    </ReportSection>
  );
}

function buildItems(headers: Header[]): KeyValueItem[] {
  const lookup = new Map(headers.map((h) => [h.name.toLowerCase(), h.value]));
  return SECURITY_HEADERS.map((name) => {
    const value = lookup.get(name);
    return {
      key: name,
      label: name,
      mono: true,
      value: value ? value : <Text className="text-sm text-muted-foreground">Not set</Text>,
    };
  });
}
