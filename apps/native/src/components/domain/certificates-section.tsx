import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { View } from "react-native";

import { Badge } from "@/components/badge";
import { RelativeExpiry } from "@/components/relative-expiry";
import { ReportSection } from "@/components/report-section";
import { Text } from "@/components/text";
import { useTRPC } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Certificate } from "@domainstack/types";
import { getRelativeExpiry } from "@domainstack/utils";

export function CertificatesSection({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.domain.getCertificates.queryOptions({ domain }));

  const certs = data.data?.certificates ?? [];
  const expiryWarning = useMemo(
    () => findExpirySoon(data.data?.certificates ?? []),
    [data.data?.certificates],
  );

  if (!data.success || certs.length === 0) {
    return (
      <ReportSection
        accent="orange"
        icon={{ android: "verified", ios: "checkmark.seal" }}
        subtitle="Active SSL certificates"
        title="Certificates"
      >
        <Text className="text-sm text-muted-foreground">
          No certificates were detected for this domain.
        </Text>
      </ReportSection>
    );
  }

  return (
    <ReportSection
      accent="orange"
      count={certs.length}
      icon={{ android: "verified", ios: "checkmark.seal" }}
      subtitle="Active SSL certificates"
      title="Certificates"
    >
      {expiryWarning ? (
        <View
          className="bg-warning-surface gap-1 rounded-xl border border-warning-border p-3"
          style={{ borderCurve: "continuous" }}
        >
          <Text className="font-semibold text-warning">Certificate expiring soon</Text>
          <Text className="text-sm text-muted-foreground">
            {expiryWarning.subject} expires {formatDate(expiryWarning.validTo)} (
            {expiryWarning.daysUntil} days).
          </Text>
        </View>
      ) : null}
      <View className="gap-3">
        {certs.map((cert) => (
          <CertificateCard cert={cert} key={`${cert.subject}-${cert.validFrom}-${cert.validTo}`} />
        ))}
      </View>
    </ReportSection>
  );
}

function CertificateCard({ cert }: { cert: Certificate }) {
  return (
    <View className="gap-2 rounded-lg border border-border p-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="font-semibold" numberOfLines={1}>
          {cert.subject}
        </Text>
        <Badge>
          <Text className="text-xs">{cert.caProvider.name ?? "Unknown CA"}</Text>
        </Badge>
      </View>
      <Text className="text-xs text-muted-foreground">Issuer: {cert.issuer}</Text>
      <View className="flex-row flex-wrap items-baseline gap-x-2">
        <Text className="text-xs text-muted-foreground">Valid {formatDate(cert.validFrom)}</Text>
        <Text className="text-xs text-muted-foreground">→ {formatDate(cert.validTo)}</Text>
        <Text className="text-xs">
          <RelativeExpiry dangerDays={7} to={cert.validTo} warnDays={14} />
        </Text>
      </View>
      {cert.altNames.length > 0 ? (
        <Text numberOfLines={3} className="text-xs text-muted-foreground">
          SANs: {cert.altNames.join(", ")}
        </Text>
      ) : null}
    </View>
  );
}

function findExpirySoon(certs: Certificate[]) {
  for (const cert of certs) {
    const info = getRelativeExpiry(cert.validTo, { dangerDays: 7, warnDays: 14 });
    if (info && info.tone !== "default") {
      return { subject: cert.subject, validTo: cert.validTo, daysUntil: info.daysUntil };
    }
  }
  return null;
}
