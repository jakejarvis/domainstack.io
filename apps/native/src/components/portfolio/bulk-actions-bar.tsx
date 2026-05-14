import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Alert, Platform, Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/button";
import { Text } from "@/components/text";
import {
  getSelectedIds,
  useSelectionActions,
  useSelectionCount,
  useSelectionMode,
} from "@/hooks/use-portfolio-selection";
import { useTRPC } from "@/lib/api";

const BULK_LIMIT = 100;
const HIDDEN_OFFSET = 120;

export function BulkActionsBar() {
  const mode = useSelectionMode();
  const count = useSelectionCount();
  const { exitSelection } = useSelectionActions();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(mode === "selecting" ? 1 : 0, { duration: 220 }));
  }, [mode, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.get()) * HIDDEN_OFFSET }],
  }));

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.tracking.listDomains.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.user.getSubscription.queryKey() }),
    ]);
  };

  const archive = useMutation(
    trpc.tracking.bulkArchiveDomains.mutationOptions({
      onSettled: async () => {
        await invalidate();
        exitSelection();
      },
    }),
  );

  const remove = useMutation(
    trpc.tracking.bulkRemoveDomains.mutationOptions({
      onSettled: async () => {
        await invalidate();
        exitSelection();
      },
    }),
  );

  const overLimit = count > BULK_LIMIT;
  const busy = archive.isPending || remove.isPending;
  const disabled = count === 0 || overLimit || busy;

  const handleArchive = () => {
    if (disabled) return;
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    archive.mutate({ trackedDomainIds: ids });
  };

  const handleRemove = () => {
    if (disabled) return;
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    Alert.alert(
      `Remove ${count} ${count === 1 ? "domain" : "domains"}?`,
      "This permanently removes tracking and notification settings.",
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: () => remove.mutate({ trackedDomainIds: ids }),
          style: "destructive",
          text: "Remove",
        },
      ],
    );
  };

  return (
    <Animated.View
      pointerEvents={mode === "selecting" ? "auto" : "none"}
      style={[
        {
          bottom: insets.bottom + 12,
          left: 12,
          position: "absolute",
          right: 12,
        },
        animatedStyle,
      ]}
    >
      <View className="border-line bg-glass gap-2 rounded-2xl border p-3">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-3">
            {Platform.OS === "android" ? (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={exitSelection}>
                <Text className="text-brand text-base font-semibold">Done</Text>
              </Pressable>
            ) : null}
            <Text className="text-sm font-semibold tabular-nums">{count} selected</Text>
          </View>
          <View className="flex-row gap-2">
            <Button
              disabled={disabled}
              loading={archive.isPending}
              onPress={handleArchive}
              variant="secondary"
            >
              <Text>Archive</Text>
            </Button>
            <Button
              disabled={disabled}
              loading={remove.isPending}
              onPress={handleRemove}
              variant="danger"
            >
              <Text>Remove</Text>
            </Button>
          </View>
        </View>
        {overLimit ? (
          <Text className="text-text-secondary text-xs">
            Select up to {BULK_LIMIT} domains at a time.
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}
