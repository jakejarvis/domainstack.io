import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { Button } from "@/components/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { GlassCard } from "@/components/glass-card";
import { MutedText, Text } from "@/components/text";
import { useTRPC } from "@/lib/api";
import { assertOnline } from "@/lib/network";

const LIST_INPUT = { includeArchived: true } as const;

export function MutedDomainsSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(trpc.tracking.listDomains.queryOptions(LIST_INPUT));
  const muted = data.filter((entry) => entry.muted);

  const [pendingId, setPendingId] = useState<string | null>(null);

  const setMuted = useMutation(
    trpc.user.setDomainMuted.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: trpc.tracking.listDomains.queryKey() }),
    }),
  );

  const target = muted.find((entry) => entry.id === pendingId) ?? null;

  async function handleConfirm() {
    if (!target) return;
    try {
      await assertOnline();
      await setMuted.mutateAsync({ muted: false, trackedDomainId: target.id });
      setPendingId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not unmute domain.";
      Alert.alert("Domainstack", message);
    }
  }

  return (
    <GlassCard>
      <Text className="text-xl font-semibold">Muted domains</Text>
      {muted.length === 0 ? (
        <MutedText>Mute a domain from its detail screen to silence its notifications.</MutedText>
      ) : (
        <View className="gap-2">
          {muted.map((entry) => (
            <View
              className="border-line bg-canvas-2 flex-row items-center gap-3 rounded-xl border p-3"
              key={entry.id}
            >
              <Pressable
                accessibilityLabel={`Open ${entry.domainName}`}
                accessibilityRole="button"
                className="min-h-12 flex-1 justify-center"
                onPress={() =>
                  router.push({
                    params: { domain: entry.domainName },
                    pathname: "/(tabs)/domains/[domain]",
                  })
                }
              >
                <Text className="font-semibold" numberOfLines={1}>
                  {entry.domainName}
                </Text>
              </Pressable>
              <Button onPress={() => setPendingId(entry.id)} variant="secondary">
                <Text>Unmute</Text>
              </Button>
            </View>
          ))}
        </View>
      )}
      <ConfirmDialog
        confirmLabel="Unmute"
        description={
          target
            ? `You'll start receiving notifications for ${target.domainName} again.`
            : undefined
        }
        loading={setMuted.isPending}
        onConfirm={handleConfirm}
        onOpenChange={(open) => {
          if (!open) setPendingId(null);
        }}
        open={target !== null}
        title={target ? `Unmute ${target.domainName}?` : "Unmute domain?"}
      />
    </GlassCard>
  );
}

export function MutedDomainsSectionSkeleton() {
  return (
    <GlassCard>
      <Text className="text-xl font-semibold">Muted domains</Text>
      <View className="gap-2">
        {[0, 1, 2].map((i) => (
          <View className="border-line bg-canvas-2 h-14 rounded-xl border" key={i} />
        ))}
      </View>
    </GlassCard>
  );
}
