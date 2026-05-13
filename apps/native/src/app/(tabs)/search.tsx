import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { GlassCard } from "@/components/glass-card";
import { Screen } from "@/components/screen";
import { SkeletonRows } from "@/components/skeleton";
import { MutedText, Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useTRPC } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { formatCount } from "@/lib/format";

function getRecordCount(data: unknown): number {
  if (!data || typeof data !== "object") return 0;
  const records = "data" in data ? (data as { data?: unknown }).data : null;
  if (Array.isArray(records)) return records.length;
  if (records && typeof records === "object" && "records" in records) {
    const nested = (records as { records?: unknown }).records;
    return Array.isArray(nested) ? nested.length : 0;
  }
  return 0;
}

function getProviderName(data: unknown): string {
  if (!data || typeof data !== "object" || !("data" in data)) return "Unknown";
  const payload = (
    data as { data?: { provider?: string; name?: string; hosting?: { name?: string } } }
  ).data;
  return payload?.hosting?.name ?? payload?.provider ?? payload?.name ?? "Unknown";
}

export default function SearchScreen() {
  const trpc = useTRPC();
  const session = authClient.useSession();
  const [domain, setDomain] = useState("");
  const [submittedDomain, setSubmittedDomain] = useState("");

  const enabled = submittedDomain.length > 0;
  const registration = useQuery(
    trpc.domain.getRegistration.queryOptions({ domain: submittedDomain }, { enabled }),
  );
  const dns = useQuery(
    trpc.domain.getDnsRecords.queryOptions({ domain: submittedDomain }, { enabled }),
  );
  const hosting = useQuery(
    trpc.domain.getHosting.queryOptions({ domain: submittedDomain }, { enabled }),
  );
  const certificates = useQuery(
    trpc.domain.getCertificates.queryOptions({ domain: submittedDomain }, { enabled }),
  );

  const loading =
    registration.isPending || dns.isPending || hosting.isPending || certificates.isPending;
  const hasError = registration.error || dns.error || hosting.error || certificates.error;
  const reportReady = enabled && !loading && !hasError;

  const summary = useMemo(
    () => [
      { label: "Registration", value: registration.data?.success ? "Found" : "Unavailable" },
      { label: "DNS records", value: formatCount(getRecordCount(dns.data)) },
      { label: "Hosting", value: getProviderName(hosting.data) },
      { label: "Certificates", value: certificates.data?.success ? "Checked" : "Unavailable" },
    ],
    [certificates.data, dns.data, hosting.data, registration.data],
  );

  return (
    <Screen>
      <View className="gap-2">
        <Text className="text-4xl font-semibold">Search</Text>
        <MutedText>Look up public registration, DNS, hosting, and certificate data.</MutedText>
      </View>

      <GlassCard>
        <TextField
          label="Domain"
          onChangeText={setDomain}
          placeholder="example.com"
          value={domain}
        />
        <Button
          disabled={domain.trim().length === 0}
          onPress={() => setSubmittedDomain(domain.trim())}
        >
          Run lookup
        </Button>
      </GlassCard>

      {!session.data?.user && (
        <GlassCard>
          <View className="gap-2">
            <Text className="text-lg font-semibold">Portfolio features are locked</Text>
            <MutedText>
              Public lookup works without an account. Sign in to track domains and receive alerts.
            </MutedText>
          </View>
          <Button onPress={() => router.push("/sign-in")} variant="secondary">
            Sign in
          </Button>
        </GlassCard>
      )}

      {enabled && loading && <SkeletonRows count={4} />}

      {hasError && (
        <EmptyState
          actionLabel="Retry"
          body="The report could not be loaded from the current connection."
          onAction={() => setSubmittedDomain(domain.trim())}
          title="Lookup failed"
        />
      )}

      {reportReady && (
        <View className="gap-3">
          <View className="flex-row items-center gap-2">
            <Text className="text-2xl font-semibold" numberOfLines={1}>
              {submittedDomain}
            </Text>
            <Badge tone="success">Live report</Badge>
          </View>

          {summary.map((row) => (
            <GlassCard key={row.label}>
              <View className="flex-row items-center justify-between gap-4">
                <MutedText>{row.label}</MutedText>
                <Text className="max-w-[58%] text-right font-semibold" numberOfLines={1}>
                  {row.value}
                </Text>
              </View>
            </GlassCard>
          ))}
        </View>
      )}
    </Screen>
  );
}
