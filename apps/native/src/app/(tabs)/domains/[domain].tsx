import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import { findNodeHandle, type ScrollView, View } from "react-native";

import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
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
import { DomainHealthBadge } from "@/components/portfolio/domain-health-badge";
import { ReportSectionSkeleton } from "@/components/report-section-skeleton";
import { Screen } from "@/components/screen";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { Text } from "@/components/text";
import { useDashboardMutations } from "@/hooks/use-dashboard-mutations";
import { analytics } from "@/lib/analytics";
import { useTRPC } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { confirmDestructive } from "@/lib/native-confirm";
import { assertOnline, isOfflineError } from "@/lib/network";
import { toast } from "@/lib/toast";
import { toastMutationError } from "@/lib/trpc-error-handler";
import { REPORT_SECTIONS, type ReportSection } from "@domainstack/constants";

const REPORT_SECTION_SET = new Set<ReportSection>(REPORT_SECTIONS);

function isReportSection(value: string | undefined): value is ReportSection {
  return typeof value === "string" && (REPORT_SECTION_SET as Set<string>).has(value);
}

export { ScreenErrorBoundary as ErrorBoundary } from "@/components/screen-error-boundary";

export default function DomainReportScreen() {
  const params = useLocalSearchParams<{ domain: string; section?: string }>();
  const raw = Array.isArray(params.domain) ? params.domain[0] : params.domain;
  const domain = (raw ?? "").trim().toLowerCase();
  const rawSection = Array.isArray(params.section) ? params.section[0] : params.section;
  const section = isReportSection(rawSection) ? rawSection : undefined;

  if (!domain) {
    return (
      <Screen>
        <EmptyState
          actionLabel="Go to search"
          body="Open this screen from your portfolio or a notification."
          icon={{ android: "help_outline", ios: "questionmark.circle" }}
          onAction={() => router.replace("/(tabs)/search")}
          title="No domain selected"
        />
      </Screen>
    );
  }

  return <DomainReportContent domain={domain} section={section} />;
}

function DomainReportContent({ domain, section }: { domain: string; section?: ReportSection }) {
  const session = authClient.useSession();
  const isAuthenticated = Boolean(session.data?.user);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigation = useNavigation();

  // The domain *is* the screen — surface it as the native collapsing large
  // title rather than as body text.
  useEffect(() => {
    navigation.setOptions({ title: domain });
  }, [navigation, domain]);

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
  // Gate the section stack on registration settling. Mounting all six sections
  // while this is pending fires six wasted fetches and six skeletons that then
  // collapse to the UnregisteredCard (large CLS) for unregistered domains.
  const registrationSettled = !registrationQuery.isPending;
  const isUnregistered = registrationQuery.data?.data?.isRegistered === false;

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

  const scrollRef = useRef<ScrollView | null>(null);
  const sectionNodes = useRef<Map<ReportSection, View>>(new Map());
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    hasScrolledRef.current = false;
  }, [domain, section]);

  const handleSectionLayout = useCallback(
    (name: ReportSection) => {
      if (!section || section !== name || hasScrolledRef.current) return;
      const node = sectionNodes.current.get(name);
      const scrollNode = scrollRef.current;
      if (!node || !scrollNode) return;
      const handle = findNodeHandle(scrollNode);
      if (handle === null) return;
      node.measureLayout(
        handle,
        (_x, y) => {
          hasScrolledRef.current = true;
          scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
        },
        () => {},
      );
    },
    [section],
  );

  const registerSectionNode = useCallback((name: ReportSection, node: View | null) => {
    if (node) sectionNodes.current.set(name, node);
    else sectionNodes.current.delete(name);
  }, []);

  return (
    <Screen onRefresh={invalidate} scrollRef={scrollRef}>
      <ReportHeader domain={domain} isAuthenticated={isAuthenticated} trackedEntry={trackedEntry} />

      {!registrationSettled ? (
        <View className="gap-5">
          <ReportSectionSkeleton />
          <ReportSectionSkeleton />
        </View>
      ) : isUnregistered ? (
        <UnregisteredCard domain={domain} />
      ) : (
        <View className="gap-5">
          <ReportSlot
            domain={domain}
            name="registration"
            onLayoutSection={handleSectionLayout}
            onRegisterNode={registerSectionNode}
            sectionName="Registration"
          >
            <RegistrationSection domain={domain} />
          </ReportSlot>
          <ReportSlot
            domain={domain}
            name="hosting"
            onLayoutSection={handleSectionLayout}
            onRegisterNode={registerSectionNode}
            sectionName="Hosting"
          >
            <HostingSection domain={domain} />
          </ReportSlot>
          <ReportSlot
            domain={domain}
            name="dns"
            onLayoutSection={handleSectionLayout}
            onRegisterNode={registerSectionNode}
            sectionName="DNS"
          >
            <DnsSection domain={domain} />
          </ReportSlot>
          <ReportSlot
            domain={domain}
            name="certificates"
            onLayoutSection={handleSectionLayout}
            onRegisterNode={registerSectionNode}
            sectionName="Certificates"
          >
            <CertificatesSection domain={domain} />
          </ReportSlot>
          <ReportSlot
            domain={domain}
            name="headers"
            onLayoutSection={handleSectionLayout}
            onRegisterNode={registerSectionNode}
            sectionName="Headers"
          >
            <HeadersSection domain={domain} />
          </ReportSlot>
          <ReportSlot
            domain={domain}
            name="seo"
            onLayoutSection={handleSectionLayout}
            onRegisterNode={registerSectionNode}
            sectionName="SEO"
          >
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
      <View className="flex-row flex-wrap items-center gap-2">
        <Favicon domain={domain} size={40} />
        {trackedEntry ? (
          <>
            <Badge dot variant={trackedEntry.verified ? "success" : "warning"}>
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
            {trackedEntry.lastVerifiedAt ? (
              <Text className="text-xs text-muted-foreground">
                Verified {formatDate(trackedEntry.lastVerifiedAt)}
              </Text>
            ) : null}
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
          <Text className="text-xs text-muted-foreground">Sign in to track this domain.</Text>
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
  const dashboard = useDashboardMutations();
  const verify = useMutation(
    trpc.tracking.verifyDomain.mutationOptions({
      onSuccess: async () => {
        toast.success(`Verified ${trackedEntry.domainName}`);
        await invalidate();
      },
    }),
  );

  async function runNetworkAction(action: () => Promise<unknown>) {
    try {
      assertOnline();
      await action();
    } catch (error) {
      // A pre-mutation offline bail-out bypasses the global mutation cache —
      // report it here so it isn't invisible. Real mutation rejections are
      // reported centrally in query-client.
      if (isOfflineError(error)) {
        analytics.trackException(error, { context: "domain_action", offline: true });
      }
      // Centralized: friendly offline toast, UNAUTHORIZED → sign-out, and
      // rate-limit handling instead of dumping a raw error message.
      toastMutationError("Action failed", error);
    }
  }

  return (
    <>
      {trackedEntry.verified ? null : (
        <Card>
          <Text className="text-lg font-semibold">Verification</Text>
          <Text className="text-sm text-muted-foreground">
            Return to the verification flow to copy DNS TXT, HTML file, or meta tag instructions and
            check ownership.
          </Text>
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
        </Card>
      )}
      <Card>
        <Button
          loading={dashboard.isMuting}
          onPress={() =>
            void runNetworkAction(() => dashboard.setMuted(trackedEntry.id, !trackedEntry.muted))
          }
          variant="secondary"
        >
          <Text>{trackedEntry.muted ? "Unmute notifications" : "Mute notifications"}</Text>
        </Button>
        <Button
          loading={dashboard.isArchiving || dashboard.isUnarchiving}
          onPress={() =>
            void runNetworkAction(() =>
              trackedEntry.archivedAt
                ? dashboard.unarchive(trackedEntry.id)
                : dashboard.archive(trackedEntry.id),
            )
          }
          variant="secondary"
        >
          <Text>{trackedEntry.archivedAt ? "Unarchive" : "Archive"}</Text>
        </Button>
        <Button
          loading={dashboard.isRemoving}
          onPress={() =>
            void confirmDestructive({
              confirmLabel: "Remove",
              message: `${trackedEntry.domainName} will stop being tracked.`,
              title: "Remove domain?",
            }).then((confirmed) => {
              if (!confirmed) return;
              void runNetworkAction(async () => {
                await dashboard.remove(trackedEntry.id);
                router.back();
              });
            })
          }
          variant="danger"
        >
          <Text>Remove</Text>
        </Button>
      </Card>
    </>
  );
}

function ReportSlot({
  children,
  domain,
  name,
  onLayoutSection,
  onRegisterNode,
  sectionName,
}: {
  children: React.ReactNode;
  domain: string;
  name: ReportSection;
  onLayoutSection: (name: ReportSection) => void;
  onRegisterNode: (name: ReportSection, node: View | null) => void;
  sectionName: string;
}) {
  const handleRef = useCallback(
    (node: View | null) => onRegisterNode(name, node),
    [name, onRegisterNode],
  );
  const handleLayout = useCallback(() => onLayoutSection(name), [name, onLayoutSection]);

  return (
    <View onLayout={handleLayout} ref={handleRef}>
      <SectionErrorBoundary key={domain} sectionName={sectionName}>
        <Suspense fallback={<ReportSectionSkeleton />}>{children}</Suspense>
      </SectionErrorBoundary>
    </View>
  );
}
