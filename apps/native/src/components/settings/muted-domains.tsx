import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Pressable, View } from "react-native";

import { Button } from "@/components/button";
import { GroupedRow, GroupedSection } from "@/components/form/group";
import { Text } from "@/components/text";
import { useTRPC } from "@/lib/api";
import { confirm } from "@/lib/native-confirm";
import { assertOnline } from "@/lib/network";
import { toast } from "@/lib/toast";

const LIST_INPUT = { includeArchived: true } as const;

export function MutedDomainsSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(trpc.tracking.listDomains.queryOptions(LIST_INPUT));
  const muted = data.filter((entry) => entry.muted);

  const setMuted = useMutation(
    trpc.user.setDomainMuted.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: trpc.tracking.listDomains.queryKey() }),
    }),
  );

  async function handleUnmute(id: string, domainName: string) {
    const accepted = await confirm({
      confirmLabel: "Unmute",
      message: `You'll start receiving notifications for ${domainName} again.`,
      title: `Unmute ${domainName}?`,
    });
    if (!accepted) return;
    try {
      await assertOnline();
      await setMuted.mutateAsync({ muted: false, trackedDomainId: id });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not unmute domain.";
      toast.error({ title: "Unmute failed", message });
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
      {muted.map((entry) => (
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
    </GroupedSection>
  );
}

export function MutedDomainsSectionSkeleton() {
  return (
    <GroupedSection title="Muted domains">
      <View className="gap-2 p-3">
        {[0, 1, 2].map((i) => (
          <View className="bg-canvas-2 h-10 rounded-xl" key={i} />
        ))}
      </View>
    </GroupedSection>
  );
}
