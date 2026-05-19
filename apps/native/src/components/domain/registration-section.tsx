import { type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
import { ScrollView, View } from "react-native";

import { AppBottomSheet, type AppBottomSheetRef } from "@/components/bottom-sheet";
import { Button } from "@/components/button";
import { KeyValueGrid, type KeyValueItem } from "@/components/key-value-grid";
import { RelativeAge } from "@/components/relative-age";
import { RelativeExpiry } from "@/components/relative-expiry";
import { ReportSection } from "@/components/report-section";
import { Text } from "@/components/text";
import { useTRPC } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { RegistrationContact, RegistrationResponse } from "@domainstack/types";

export function RegistrationSection({ domain }: { domain: string }) {
  const { t } = useLingui();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.domain.getRegistration.queryOptions({ domain }));

  if (!data.success || !data.data) {
    return (
      <ReportSection
        accent="purple"
        icon={{ android: "contact_page", ios: "person.text.rectangle" }}
        subtitle="WHOIS · RDAP"
        title={t`Registration`}
      >
        <Text className="text-sm text-muted-foreground">
          <Trans>Registration data is unavailable for this domain.</Trans>
        </Text>
      </ReportSection>
    );
  }

  return <RegistrationSectionBody data={data.data} />;
}

function RegistrationSectionBody({ data }: { data: RegistrationResponse }) {
  const { t, i18n } = useLingui();
  const items = useMemo(() => buildItems(data, i18n), [data, i18n]);
  const isUnavailable = data.status === "unknown";
  const rawResponse = data.rawResponse;

  return (
    <ReportSection
      accent="purple"
      icon={{ android: "contact_page", ios: "person.text.rectangle" }}
      subtitle="WHOIS · RDAP"
      title={t`Registration`}
    >
      {isUnavailable ? (
        <UnavailableBanner reason={data.unavailableReason} tld={data.tld} />
      ) : (
        <KeyValueGrid items={items} />
      )}
      {rawResponse ? <RawDataToggle raw={rawResponse} format={data.source} /> : null}
    </ReportSection>
  );
}

function buildItems(data: RegistrationResponse, i18n: I18n): KeyValueItem[] {
  const items: KeyValueItem[] = [];
  items.push({
    key: "registrar",
    label: i18n._(msg`Registrar`),
    value: data.registrarProvider?.name ?? data.registrar?.name ?? i18n._(msg`Unknown`),
  });

  const registrant = extractRegistrant(data.contacts);
  items.push({
    key: "registrant",
    label: i18n._(msg`Registrant`),
    value: data.privacyEnabled || !registrant ? i18n._(msg`Hidden`) : registrant,
  });

  if (data.creationDate) {
    items.push({
      key: "created",
      label: i18n._(msg`Created`),
      value: (
        <View className="flex-row flex-wrap items-baseline gap-x-2">
          <Text>{formatDate(data.creationDate)}</Text>
          <Text className="text-xs text-muted-foreground">
            <RelativeAge from={data.creationDate} />
          </Text>
        </View>
      ),
    });
  }

  if (data.expirationDate) {
    items.push({
      key: "expires",
      label: i18n._(msg`Expires`),
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

  const nameservers = data.nameservers?.flatMap((ns) => (ns.host ? [ns.host] : [])) ?? [];
  if (nameservers.length > 0) {
    items.push({
      key: "nameservers",
      label: i18n._(msg`Nameservers`),
      value: (
        <View className="gap-0.5">
          {nameservers.map((ns) => (
            <Text className="font-mono text-sm" key={ns} selectable>
              {ns}
            </Text>
          ))}
        </View>
      ),
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
  const { t } = useLingui();
  return (
    <View
      className="bg-warning-surface gap-1 rounded-xl border border-warning-border p-3"
      style={{ borderCurve: "continuous" }}
    >
      <Text className="font-semibold text-warning">
        <Trans>Registration data unavailable</Trans>
      </Text>
      <Text className="text-sm text-muted-foreground">
        {reason === "timeout"
          ? t`WHOIS/RDAP lookup timed out. This may be a temporary issue with the registry.`
          : reason === "unsupported_tld"
            ? t`The .${tld} registry does not publish public WHOIS/RDAP data.`
            : t`Registration information could not be retrieved at this time.`}
      </Text>
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
  const { t } = useLingui();
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const text = useMemo(() => (typeof raw === "string" ? raw : JSON.stringify(raw, null, 2)), [raw]);
  const label = format === "rdap" ? "RDAP" : "WHOIS";

  return (
    <View className="gap-2">
      <Button onPress={() => sheetRef.current?.present()} variant="ghost">
        <Text>
          <Trans>View raw {label}</Trans>
        </Text>
      </Button>
      <AppBottomSheet description={t`Raw ${label} response`} ref={sheetRef} title={t`Raw ${label}`}>
        <ScrollView
          className="flex-1 rounded-lg border border-border bg-secondary p-3"
          contentContainerStyle={{ paddingBottom: 8 }}
        >
          <Text className="font-mono text-xs" selectable>
            {text}
          </Text>
        </ScrollView>
      </AppBottomSheet>
    </View>
  );
}
