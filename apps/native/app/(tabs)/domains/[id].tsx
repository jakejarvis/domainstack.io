import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, View } from "react-native";

import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { GlassCard } from "@/components/glass-card";
import { Screen } from "@/components/screen";
import { SkeletonRows } from "@/components/skeleton";
import { MutedText, Text } from "@/components/text";
import { useTRPC } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { assertOnline } from "@/lib/network";

function MetricRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <MutedText className="flex-1">{label}</MutedText>
      <Text className="max-w-[62%] text-right font-semibold" numberOfLines={1}>
        {value || "Unknown"}
      </Text>
    </View>
  );
}

export default function DomainDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const trackedDomainId = Array.isArray(params.id) ? params.id[0] : params.id;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const domainQuery = useQuery(trpc.tracking.getDomainDetails.queryOptions({ trackedDomainId }));

  const invalidate = async () => {
    await queryClient.invalidateQueries();
  };

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
  const verify = useMutation(trpc.tracking.verifyDomain.mutationOptions({ onSuccess: invalidate }));

  const domain = domainQuery.data;

  async function runNetworkAction(action: () => Promise<unknown>) {
    try {
      await assertOnline();
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed";
      Alert.alert("Domainstack", message);
    }
  }

  return (
    <Screen>
      {domainQuery.isPending && <SkeletonRows count={4} />}

      {domainQuery.error && (
        <EmptyState
          actionLabel="Retry"
          body={domainQuery.error.message}
          onAction={() => void domainQuery.refetch()}
          title="Domain did not load"
        />
      )}

      {domain && (
        <>
          <View className="gap-2">
            <Text className="text-4xl font-semibold" numberOfLines={1}>
              {domain.domainName}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <Badge tone={domain.verified ? "success" : "warning"}>
                {domain.verified ? "Verified" : "Needs verification"}
              </Badge>
              {domain.muted && <Badge>Muted</Badge>}
              {domain.archivedAt && <Badge>Archived</Badge>}
            </View>
          </View>

          <GlassCard>
            <MetricRow label="Expiry" value={formatDate(domain.expirationDate)} />
            <MetricRow label="Registrar" value={domain.registrar.name} />
            <MetricRow label="DNS" value={domain.dns.name} />
            <MetricRow label="Hosting" value={domain.hosting.name} />
            <MetricRow label="Email" value={domain.email.name} />
            <MetricRow label="Certificate authority" value={domain.ca.name} />
            <MetricRow label="Last verified" value={formatDate(domain.lastVerifiedAt)} />
          </GlassCard>

          {!domain.verified && (
            <GlassCard>
              <Text className="text-lg font-semibold">Verification</Text>
              <MutedText>
                Return to the verification flow to copy DNS TXT, HTML file, or meta tag instructions
                and check ownership.
              </MutedText>
              <Button
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/domains/add",
                    params: { trackedDomainId: domain.id },
                  })
                }
                variant="secondary"
              >
                Resume verification
              </Button>
              <Button
                loading={verify.isPending}
                onPress={() =>
                  void runNetworkAction(() => verify.mutateAsync({ trackedDomainId: domain.id }))
                }
              >
                Verify now
              </Button>
            </GlassCard>
          )}

          <GlassCard>
            <Button
              loading={setMuted.isPending}
              onPress={() =>
                void runNetworkAction(() =>
                  setMuted.mutateAsync({
                    muted: !domain.muted,
                    trackedDomainId: domain.id,
                  }),
                )
              }
              variant="secondary"
            >
              {domain.muted ? "Unmute alerts" : "Mute alerts"}
            </Button>
            <Button
              loading={archive.isPending || unarchive.isPending}
              onPress={() =>
                void runNetworkAction(() =>
                  domain.archivedAt
                    ? unarchive.mutateAsync({ trackedDomainId: domain.id })
                    : archive.mutateAsync({ trackedDomainId: domain.id }),
                )
              }
              variant="secondary"
            >
              {domain.archivedAt ? "Unarchive" : "Archive"}
            </Button>
            <Button
              loading={remove.isPending}
              onPress={() =>
                Alert.alert("Remove domain?", `${domain.domainName} will stop being tracked.`, [
                  { style: "cancel", text: "Cancel" },
                  {
                    onPress: () =>
                      void runNetworkAction(() =>
                        remove.mutateAsync({ trackedDomainId: domain.id }),
                      ),
                    style: "destructive",
                    text: "Remove",
                  },
                ])
              }
              variant="danger"
            >
              Remove
            </Button>
          </GlassCard>
        </>
      )}
    </Screen>
  );
}
