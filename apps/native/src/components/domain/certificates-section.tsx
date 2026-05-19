import { Trans, useLingui } from "@lingui/react/macro";
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
  const { t } = useLingui();
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
        subtitle={t`Active SSL certificates`}
        title={t`Certificates`}
      >
        <Text className="text-sm text-muted-foreground">
          <Trans>No certificates were detected for this domain.</Trans>
        </Text>
      </ReportSection>
    );
  }

  const warningSubject = expiryWarning?.subject;
  const warningDate = expiryWarning ? formatDate(expiryWarning.validTo) : null;
  const warningDays = expiryWarning?.daysUntil;

  return (
    <ReportSection
      accent="orange"
      count={certs.length}
      icon={{ android: "verified", ios: "checkmark.seal" }}
      subtitle={t`Active SSL certificates`}
      title={t`Certificates`}
    >
      {expiryWarning ? (
        <View
          className="bg-warning-surface gap-1 rounded-xl border border-warning-border p-3"
          style={{ borderCurve: "continuous" }}
        >
          <Text className="font-semibold text-warning">
            <Trans>Certificate expiring soon</Trans>
          </Text>
          <Text className="text-sm text-muted-foreground">
            <Trans>
              {warningSubject} expires {warningDate} ({warningDays} days).
            </Trans>
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
  const { t } = useLingui();
  const issuer = cert.issuer;
  const validFrom = formatDate(cert.validFrom);
  return (
    <View className="gap-2 rounded-lg border border-border p-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="font-semibold" numberOfLines={1}>
          {cert.subject}
        </Text>
        <Badge>
          <Text className="text-xs">{cert.caProvider.name ?? t`Unknown CA`}</Text>
        </Badge>
      </View>
      <Text className="text-xs text-muted-foreground">
        <Trans>Issuer: {issuer}</Trans>
      </Text>
      <View className="flex-row flex-wrap items-baseline gap-x-2">
        <Text className="text-xs text-muted-foreground">
          <Trans>Valid {validFrom}</Trans>
        </Text>
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
