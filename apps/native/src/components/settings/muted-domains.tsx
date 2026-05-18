import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import { Pressable, View } from "react-native";

import { Button } from "@/components/button";
import { GroupedRow, GroupedSection } from "@/components/form/group";
import { Text } from "@/components/text";
import { analytics } from "@/lib/analytics";
import { useTRPC } from "@/lib/api";
import { confirm } from "@/lib/native-confirm";
import { assertOnline, isOfflineError } from "@/lib/network";
import { toastMutationError } from "@/lib/trpc-error-handler";

const LIST_INPUT = { includeArchived: true } as const;

// This section renders inside the Settings ScrollView, so a nested FlashList
// would be a worse anti-pattern (RN can't measure a VirtualizedList in a
// ScrollView). Instead we bound the inline render and send the overflow to the
// Portfolio, which IS the virtualized FlashList surface and supports unmuting.
const MUTED_PREVIEW_LIMIT = 25;

export function MutedDomainsSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(trpc.tracking.listDomains.queryOptions(LIST_INPUT));
  const muted = data.filter((entry) => entry.muted);
  const visibleMuted = muted.slice(0, MUTED_PREVIEW_LIMIT);
  const overflowCount = muted.length - visibleMuted.length;

  const setMuted = useMutation(
    trpc.user.setDomainMuted.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: trpc.tracking.listDomains.queryKey() }),
    }),
  );

  async function handleUnmute(id: string, domainName: string) {
    const accepted = await confirm({
      confirmLabel: "Unmute",
      message: `You’ll start receiving notifications for ${domainName} again.`,
      title: `Unmute ${domainName}?`,
    });
    if (!accepted) return;
    try {
      assertOnline();
      await setMuted.mutateAsync({ muted: false, trackedDomainId: id });
    } catch (error) {
      // Pre-mutation offline bail-out bypasses the global mutation cache.
      if (isOfflineError(error)) {
        analytics.trackException(error, { context: "unmute_domain", offline: true });
      }
      toastMutationError("Unmute failed", error);
    }
  }

  if (muted.length === 0) {
    return (
      <GroupedSection
        footer="Mute a domain from its detail screen to silence its notifications."
        title="Muted domains"
      />
    );
  }

  return (
    <GroupedSection title="Muted domains">
      {visibleMuted.map((entry) => (
        <Link
          asChild
          href={{
            params: { domain: entry.domainName },
            pathname: "/(tabs)/domains/[domain]",
          }}
          key={entry.id}
        >
          <Link.Trigger>
            <Pressable accessibilityLabel={`Open ${entry.domainName}`} accessibilityRole="link">
              <GroupedRow
                trailing={
                  <Button
                    disabled={setMuted.isPending}
                    onPress={() => void handleUnmute(entry.id, entry.domainName)}
                    variant="secondary"
                  >
                    <Text>Unmute</Text>
                  </Button>
                }
              >
                <Text className="font-semibold" numberOfLines={1}>
                  {entry.domainName}
                </Text>
              </GroupedRow>
            </Pressable>
          </Link.Trigger>
          <Link.Preview />
          <Link.Menu>
            <Link.MenuAction
              icon="bell"
              onPress={() => void handleUnmute(entry.id, entry.domainName)}
            >
              Unmute notifications
            </Link.MenuAction>
          </Link.Menu>
        </Link>
      ))}
      {overflowCount > 0 ? (
        <GroupedRow onPress={() => router.push("/(tabs)/domains")} showChevron>
          <Text className="font-semibold">View all {muted.length} muted in Portfolio</Text>
        </GroupedRow>
      ) : null}
    </GroupedSection>
  );
}

export function MutedDomainsSectionSkeleton() {
  return (
    <GroupedSection title="Muted domains">
      <View className="gap-2 p-3">
        {["muted-skeleton-a", "muted-skeleton-b", "muted-skeleton-c"].map((key) => (
          <View className="h-10 rounded-xl bg-muted" key={key} />
        ))}
      </View>
    </GroupedSection>
  );
}
