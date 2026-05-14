import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Suspense, useEffect, useMemo } from "react";
import { Alert, View } from "react-native";

import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { CertificatesSection } from "@/components/domain/certificates-section";
import { DnsSection } from "@/components/domain/dns-section";
import { ExportButton } from "@/components/domain/export-button";
import { Favicon } from "@/components/domain/favicon";
import { HeadersSection } from "@/components/domain/headers-section";
import { HostingSection } from "@/components/domain/hosting-section";
import { RegistrationSection } from "@/components/domain/registration-section";
import { SeoSection } from "@/components/domain/seo-section";
import { ToolsSheet } from "@/components/domain/tools-sheet";
import { UnregisteredCard } from "@/components/domain/unregistered-card";
import { EmptyState } from "@/components/empty-state";
import { GlassCard } from "@/components/glass-card";
import { DomainHealthBadge } from "@/components/portfolio/domain-health-badge";
import { ReportSectionSkeleton } from "@/components/report-section-skeleton";
import { Screen } from "@/components/screen";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { MutedText, Text } from "@/components/text";
import { analytics } from "@/lib/analytics";
import { useTRPC } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { assertOnline } from "@/lib/network";
import { toast } from "@/lib/toast";

export default function DomainReportScreen() {
  const params = useLocalSearchParams<{ domain: string }>();
  const raw = Array.isArray(params.domain) ? params.domain[0] : params.domain;
  const domain = (raw ?? "").trim().toLowerCase();

  if (!domain) {
    return (
      <Screen>
        <EmptyState
          body="Open this screen from your portfolio or a notification."
          title="No domain selected"
        />
      </Screen>
    );
  }

  return <DomainReportContent domain={domain} />;
}

function DomainReportContent({ domain }: { domain: string }) {
  const session = authClient.useSession();
  const isAuthenticated = Boolean(session.data?.user);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Tracking lookup is gated on auth — anonymous users still see the report
  // but get no portfolio-specific actions.
  const trackingQuery = useQuery({
    ...trpc.tracking.listDomains.queryOptions({ includeArchived: true }),
    enabled: isAuthenticated,
  });

  const trackedEntry = useMemo(
    () => trackingQuery.data?.find((entry) => entry.domainName === domain) ?? null,
    [trackingQuery.data, domain],
  );

  // The registration query also gates whether we render the full section stack
  // or the unregistered card. Reading it here is free since each section already
  // uses the same query via useSuspenseQuery; the cache is shared.
  const registrationQuery = useQuery(trpc.domain.getRegistration.queryOptions({ domain }));
  const isUnregistered = registrationQuery.data?.data?.isRegistered === false;

  // Kick off all six per-section queries in parallel as soon as we render.
  useEffect(() => {
    const input = { domain };
    void queryClient.prefetchQuery(trpc.domain.getRegistration.queryOptions(input));
    void queryClient.prefetchQuery(trpc.domain.getHosting.queryOptions(input));
    void queryClient.prefetchQuery(trpc.domain.getDnsRecords.queryOptions(input));
    void queryClient.prefetchQuery(trpc.domain.getCertificates.queryOptions(input));
    void queryClient.prefetchQuery(trpc.domain.getHeaders.queryOptions(input));
    void queryClient.prefetchQuery(trpc.domain.getSeo.queryOptions(input));
  }, [domain, queryClient, trpc]);

  useEffect(() => {
    analytics.track("report_viewed", { domain });
  }, [domain]);

  const invalidate = async () => {
    const input = { domain };
    const promises: Promise<unknown>[] = [
      queryClient.invalidateQueries({ queryKey: trpc.domain.getRegistration.queryKey(input) }),
      queryClient.invalidateQueries({ queryKey: trpc.domain.getHosting.queryKey(input) }),
      queryClient.invalidateQueries({ queryKey: trpc.domain.getDnsRecords.queryKey(input) }),
      queryClient.invalidateQueries({ queryKey: trpc.domain.getCertificates.queryKey(input) }),
      queryClient.invalidateQueries({ queryKey: trpc.domain.getHeaders.queryKey(input) }),
      queryClient.invalidateQueries({ queryKey: trpc.domain.getSeo.queryKey(input) }),
    ];
    if (isAuthenticated) {
      promises.push(
        queryClient.invalidateQueries({ queryKey: trpc.tracking.listDomains.queryKey() }),
      );
    }
    await Promise.all(promises);
  };

  return (
    <Screen onRefresh={invalidate}>
      <ReportHeader domain={domain} isAuthenticated={isAuthenticated} trackedEntry={trackedEntry} />

      {isUnregistered ? (
        <UnregisteredCard domain={domain} />
      ) : (
        <View className="gap-5">
          <ReportSlot domain={domain} sectionName="Registration">
            <RegistrationSection domain={domain} />
          </ReportSlot>
          <ReportSlot domain={domain} sectionName="Hosting">
            <HostingSection domain={domain} />
          </ReportSlot>
          <ReportSlot domain={domain} sectionName="DNS">
            <DnsSection domain={domain} />
          </ReportSlot>
          <ReportSlot domain={domain} sectionName="Certificates">
            <CertificatesSection domain={domain} />
          </ReportSlot>
          <ReportSlot domain={domain} sectionName="Headers">
            <HeadersSection domain={domain} />
          </ReportSlot>
          <ReportSlot domain={domain} sectionName="SEO">
            <SeoSection domain={domain} />
          </ReportSlot>
        </View>
      )}

      {trackedEntry && !isUnregistered ? (
        <TrackingActions trackedEntry={trackedEntry} invalidate={invalidate} />
      ) : null}
    </Screen>
  );
}

type TrackedEntry = {
  id: string;
  domainName: string;
  verified: boolean;
  muted: boolean;
  archivedAt: Date | null;
  lastVerifiedAt: Date | null;
  expirationDate: Date | null;
};

function ReportHeader({
  domain,
  isAuthenticated,
  trackedEntry,
}: {
  domain: string;
  isAuthenticated: boolean;
  trackedEntry: TrackedEntry | null;
}) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3">
        <Favicon domain={domain} />
        <Text className="flex-1 text-4xl font-semibold" numberOfLines={1} selectable>
          {domain}
        </Text>
      </View>
      <View className="flex-row flex-wrap items-center gap-2">
        {trackedEntry ? (
          <>
            <Badge tone={trackedEntry.verified ? "success" : "warning"}>
              <Text>{trackedEntry.verified ? "Verified" : "Needs verification"}</Text>
            </Badge>
            <DomainHealthBadge
              expirationDate={trackedEntry.expirationDate}
              verified={trackedEntry.verified}
            />
            {trackedEntry.muted ? (
              <Badge>
                <Text>Muted</Text>
              </Badge>
            ) : null}
            {trackedEntry.archivedAt ? (
              <Badge>
                <Text>Archived</Text>
              </Badge>
            ) : null}
            <MutedText className="text-xs">
              Last verified {formatDate(trackedEntry.lastVerifiedAt)}
            </MutedText>
          </>
        ) : isAuthenticated ? (
          <Button
            onPress={() =>
              router.push({
                params: { domain },
                pathname: "/(tabs)/domains/add",
              })
            }
            variant="secondary"
          >
            <Text>+ Track this domain</Text>
          </Button>
        ) : (
          <MutedText className="text-xs">Sign in to track this domain.</MutedText>
        )}
      </View>
      <View className="flex-row flex-wrap gap-2">
        <ToolsSheet domain={domain} />
        <ExportButton domain={domain} />
      </View>
    </View>
  );
}

function TrackingActions({
  trackedEntry,
  invalidate,
}: {
  trackedEntry: TrackedEntry;
  invalidate: () => Promise<void>;
}) {
  const trpc = useTRPC();
  const setMuted = useMutation(trpc.user.setDomainMuted.mutationOptions({ onSuccess: invalidate }));
  const archive = useMutation(
    trpc.tracking.archiveDomain.mutationOptions({ onSuccess: invalidate }),
  );
  const unarchive = useMutation(
    trpc.tracking.unarchiveDomain.mutationOptions({ onSuccess: invalidate }),
  );
  const remove = useMutation(
    trpc.tracking.removeDomain.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        router.back();
      },
    }),
  );
  const verify = useMutation(
    trpc.tracking.verifyDomain.mutationOptions({
      onSuccess: async (_data, _vars) => {
        toast.success(`Verified ${trackedEntry.domainName}`);
        await invalidate();
      },
    }),
  );

  async function runNetworkAction(action: () => Promise<unknown>) {
    try {
      await assertOnline();
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed";
      toast.error({ title: "Action failed", message });
    }
  }

  return (
    <>
      {trackedEntry.verified ? null : (
        <GlassCard>
          <Text className="text-lg font-semibold">Verification</Text>
          <MutedText>
            Return to the verification flow to copy DNS TXT, HTML file, or meta tag instructions and
            check ownership.
          </MutedText>
          <Button
            onPress={() =>
              router.push({
                params: { trackedDomainId: trackedEntry.id },
                pathname: "/(tabs)/domains/add",
              })
            }
            variant="secondary"
          >
            <Text>Resume verification</Text>
          </Button>
          <Button
            loading={verify.isPending}
            onPress={() =>
              void runNetworkAction(() => verify.mutateAsync({ trackedDomainId: trackedEntry.id }))
            }
          >
            <Text>Verify now</Text>
          </Button>
        </GlassCard>
      )}
      <GlassCard>
        <Button
          loading={setMuted.isPending}
          onPress={() =>
            void runNetworkAction(() =>
              setMuted.mutateAsync({
                muted: !trackedEntry.muted,
                trackedDomainId: trackedEntry.id,
              }),
            )
          }
          variant="secondary"
        >
          <Text>{trackedEntry.muted ? "Unmute notifications" : "Mute notifications"}</Text>
        </Button>
        <Button
          loading={archive.isPending || unarchive.isPending}
          onPress={() =>
            void runNetworkAction(() =>
              trackedEntry.archivedAt
                ? unarchive.mutateAsync({ trackedDomainId: trackedEntry.id })
                : archive.mutateAsync({ trackedDomainId: trackedEntry.id }),
            )
          }
          variant="secondary"
        >
          <Text>{trackedEntry.archivedAt ? "Unarchive" : "Archive"}</Text>
        </Button>
        <Button
          loading={remove.isPending}
          onPress={() =>
            Alert.alert("Remove domain?", `${trackedEntry.domainName} will stop being tracked.`, [
              { style: "cancel", text: "Cancel" },
              {
                onPress: () =>
                  void runNetworkAction(() =>
                    remove.mutateAsync({ trackedDomainId: trackedEntry.id }),
                  ),
                style: "destructive",
                text: "Remove",
              },
            ])
          }
          variant="danger"
        >
          <Text>Remove</Text>
        </Button>
      </GlassCard>
    </>
  );
}

function ReportSlot({
  children,
  domain,
  sectionName,
}: {
  children: React.ReactNode;
  domain: string;
  sectionName: string;
}) {
  return (
    <SectionErrorBoundary key={domain} sectionName={sectionName}>
      <Suspense fallback={<ReportSectionSkeleton />}>{children}</Suspense>
    </SectionErrorBoundary>
  );
}
