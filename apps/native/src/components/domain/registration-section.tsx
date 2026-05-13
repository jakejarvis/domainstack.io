import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

import { Button } from "@/components/button";
import { KeyValueGrid, type KeyValueItem } from "@/components/key-value-grid";
import { RelativeAge } from "@/components/relative-age";
import { RelativeExpiry } from "@/components/relative-expiry";
import { ReportSection } from "@/components/report-section";
import { MutedText, Text } from "@/components/text";
import { useTRPC } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { RegistrationContact, RegistrationResponse } from "@domainstack/types";

export function RegistrationSection({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.domain.getRegistration.queryOptions({ domain }));

  if (!data.success || !data.data) {
    return (
      <ReportSection title="Registration">
        <MutedText>Registration data is unavailable for this domain.</MutedText>
      </ReportSection>
    );
  }

  return <RegistrationSectionBody data={data.data} />;
}

function RegistrationSectionBody({ data }: { data: RegistrationResponse }) {
  const items = useMemo(() => buildItems(data), [data]);
  const isUnavailable = data.status === "unknown";
  const rawResponse = data.rawResponse;

  return (
    <ReportSection title="Registration">
      {isUnavailable ? (
        <UnavailableBanner reason={data.unavailableReason} tld={data.tld} />
      ) : (
        <KeyValueGrid items={items} />
      )}
      {rawResponse ? <RawDataToggle raw={rawResponse} format={data.source} /> : null}
    </ReportSection>
  );
}

function buildItems(data: RegistrationResponse): KeyValueItem[] {
  const items: KeyValueItem[] = [];
  items.push({
    key: "registrar",
    label: "Registrar",
    value: data.registrarProvider?.name ?? data.registrar?.name ?? "Unknown",
  });

  const registrant = extractRegistrant(data.contacts);
  items.push({
    key: "registrant",
    label: "Registrant",
    value: data.privacyEnabled || !registrant ? "Hidden" : registrant,
  });

  if (data.creationDate) {
    items.push({
      key: "created",
      label: "Created",
      value: (
        <View className="flex-row flex-wrap items-baseline gap-x-2">
          <Text>{formatDate(data.creationDate)}</Text>
          <MutedText className="text-xs">
            <RelativeAge from={data.creationDate} />
          </MutedText>
        </View>
      ),
    });
  }

  if (data.expirationDate) {
    items.push({
      key: "expires",
      label: "Expires",
      value: (
        <View className="flex-row flex-wrap items-baseline gap-x-2">
          <Text>{formatDate(data.expirationDate)}</Text>
          <Text className="text-xs">
            <RelativeExpiry dangerDays={30} to={data.expirationDate} warnDays={45} />
          </Text>
        </View>
      ),
    });
  }

  const nameservers = data.nameservers?.map((ns) => ns.host).filter(Boolean) ?? [];
  if (nameservers.length > 0) {
    items.push({
      key: "nameservers",
      label: "Nameservers",
      mono: true,
      value: nameservers.join("\n"),
    });
  }

  return items;
}

function extractRegistrant(contacts: RegistrationContact[] | undefined): string | null {
  const registrant = contacts?.find((c) => c.type === "registrant");
  if (!registrant) return null;
  const org = (registrant.organization || registrant.name || "").trim();
  const country = registrant.country || registrant.countryCode || "";
  const state = registrant.state || "";
  const location = [state, country].filter(Boolean).join(", ");
  const parts = [org, location].filter(Boolean);
  return parts.length > 0 ? parts.join(" — ") : null;
}

function UnavailableBanner({
  reason,
  tld,
}: {
  reason: RegistrationResponse["unavailableReason"];
  tld: string;
}) {
  return (
    <View className="bg-warning-soft gap-1 rounded-lg border border-warning p-3">
      <Text className="font-semibold text-warning">Registration data unavailable</Text>
      <MutedText>
        {reason === "timeout"
          ? "WHOIS/RDAP lookup timed out. This may be a temporary issue with the registry."
          : reason === "unsupported_tld"
            ? `The .${tld} registry does not publish public WHOIS/RDAP data.`
            : "Registration information could not be retrieved at this time."}
      </MutedText>
    </View>
  );
}

function RawDataToggle({
  raw,
  format,
}: {
  raw: Record<string, unknown> | string;
  format: RegistrationResponse["source"];
}) {
  const [expanded, setExpanded] = useState(false);
  const text = useMemo(() => (typeof raw === "string" ? raw : JSON.stringify(raw, null, 2)), [raw]);

  return (
    <View className="gap-2">
      <Button onPress={() => setExpanded((prev) => !prev)} variant="ghost">
        <Text>
          {expanded ? "Hide" : "View"} raw {format === "rdap" ? "RDAP" : "WHOIS"}
        </Text>
      </Button>
      {expanded ? (
        <ScrollView
          className="border-line bg-control-secondary max-h-64 rounded-lg border p-3"
          horizontal={false}
        >
          <Text className="font-mono text-xs" selectable>
            {text}
          </Text>
        </ScrollView>
      ) : null}
    </View>
  );
}
