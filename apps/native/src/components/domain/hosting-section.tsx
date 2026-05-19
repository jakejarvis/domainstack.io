import { Trans, useLingui } from "@lingui/react/macro";
import { useSuspenseQuery } from "@tanstack/react-query";

import { HostingMap } from "@/components/domain/hosting-map";
import { KeyValueGrid, type KeyValueItem } from "@/components/key-value-grid";
import { ReportSection } from "@/components/report-section";
import { Text } from "@/components/text";
import { useTRPC } from "@/lib/api";
import { countryCodeToEmoji } from "@domainstack/utils";

export function HostingSection({ domain }: { domain: string }) {
  const { t } = useLingui();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.domain.getHosting.queryOptions({ domain }));

  if (!data.success || !data.data) {
    return (
      <ReportSection
        accent="blue"
        icon={{ android: "cloud", ios: "cloud" }}
        subtitle="DNS · hosting · email"
        title={t`Hosting`}
      >
        <Text className="text-sm text-muted-foreground">
          <Trans>Hosting information is unavailable.</Trans>
        </Text>
      </ReportSection>
    );
  }

  const hosting = data.data;
  const items: KeyValueItem[] = [];

  items.push({
    key: "host",
    label: t`Host`,
    value: hosting.hostingProvider.name ?? t`Unknown`,
  });
  items.push({
    key: "dns-provider",
    label: t`DNS provider`,
    value: hosting.dnsProvider.name ?? t`Unknown`,
  });
  items.push({
    key: "email-provider",
    label: t`Email provider`,
    value: hosting.emailProvider.name ?? t`Unknown`,
  });

  if (hosting.geo) {
    const flag = hosting.geo.country_code ? countryCodeToEmoji(hosting.geo.country_code) : "";
    const locationParts = [hosting.geo.city, hosting.geo.region, hosting.geo.country].filter(
      Boolean,
    );
    const location = locationParts.length > 0 ? locationParts.join(", ") : t`Unknown`;
    items.push({
      key: "location",
      label: t`Location`,
      value: flag ? `${flag} ${location}` : location,
    });
  }

  return (
    <ReportSection
      accent="blue"
      icon={{ android: "cloud", ios: "cloud" }}
      subtitle="DNS · hosting · email"
      title={t`Hosting`}
    >
      <KeyValueGrid items={items} />
      {hosting.geo?.lat != null && hosting.geo?.lon != null ? (
        <HostingMap lat={hosting.geo.lat} lon={hosting.geo.lon} domain={domain} />
      ) : null}
    </ReportSection>
  );
}
