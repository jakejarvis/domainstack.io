import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { View } from "react-native";

import { Badge } from "@/components/badge";
import { RelativeExpiry } from "@/components/relative-expiry";
import { ReportSection } from "@/components/report-section";
import { MutedText, Text } from "@/components/text";
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
      <ReportSection title="Certificates">
        <MutedText>No certificates were detected for this domain.</MutedText>
      </ReportSection>
    );
  }

  return (
    <ReportSection title="Certificates">
      {expiryWarning ? (
        <View className="bg-warning-soft gap-1 rounded-lg border border-warning p-3">
          <Text className="font-semibold text-warning">Certificate expiring soon</Text>
          <MutedText>
            {expiryWarning.subject} expires {formatDate(expiryWarning.validTo)} (
            {expiryWarning.daysUntil} days).
          </MutedText>
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
    <View className="border-line gap-2 rounded-lg border p-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="font-semibold" numberOfLines={1}>
          {cert.subject}
        </Text>
        <Badge>
          <Text className="text-xs">{cert.caProvider.name ?? "Unknown CA"}</Text>
        </Badge>
      </View>
      <MutedText className="text-xs">Issuer: {cert.issuer}</MutedText>
      <View className="flex-row flex-wrap items-baseline gap-x-2">
        <MutedText className="text-xs">Valid {formatDate(cert.validFrom)}</MutedText>
        <MutedText className="text-xs">→ {formatDate(cert.validTo)}</MutedText>
        <Text className="text-xs">
          <RelativeExpiry dangerDays={7} to={cert.validTo} warnDays={14} />
        </Text>
      </View>
      {cert.altNames.length > 0 ? (
        <MutedText className="text-xs" numberOfLines={3}>
          SANs: {cert.altNames.join(", ")}
        </MutedText>
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
