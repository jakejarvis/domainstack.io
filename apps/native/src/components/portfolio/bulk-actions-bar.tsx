import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Alert, Platform, Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { AppBottomSheet, type AppBottomSheetRef } from "@/components/bottom-sheet";
import { Button } from "@/components/button";
import { GlassCard } from "@/components/glass-card";
import { MutedText, Text } from "@/components/text";
import {
  getSelectedIds,
  useSelectionActions,
  useSelectionCount,
  useSelectionMode,
} from "@/hooks/use-portfolio-selection";
import { useTRPC } from "@/lib/api";
import { toast } from "@/lib/toast";

const BULK_LIMIT = 100;
const HIDDEN_OFFSET = 120;

export function BulkActionsBar() {
  const mode = useSelectionMode();
  const count = useSelectionCount();
  const { exitSelection } = useSelectionActions();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const overflowSheetRef = useRef<AppBottomSheetRef | null>(null);

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
      onSuccess: (_data, variables) => {
        const n = variables.trackedDomainIds.length;
        toast.success(`Archived ${n} ${n === 1 ? "domain" : "domains"}`);
      },
      onError: (err) => {
        toast.error({ title: "Archive failed", message: err.message });
      },
      onSettled: async () => {
        await invalidate();
        exitSelection();
      },
    }),
  );

  const remove = useMutation(
    trpc.tracking.bulkRemoveDomains.mutationOptions({
      onSuccess: (_data, variables) => {
        const n = variables.trackedDomainIds.length;
        toast.success(`Removed ${n} ${n === 1 ? "domain" : "domains"}`);
      },
      onError: (err) => {
        toast.error({ title: "Remove failed", message: err.message });
      },
      onSettled: async () => {
        await invalidate();
        exitSelection();
      },
    }),
  );

  const setMuted = useMutation(
    trpc.tracking.bulkSetMuted.mutationOptions({
      onSuccess: ({ successCount }, variables) => {
        const verb = variables.muted ? "Muted" : "Unmuted";
        toast.success(`${verb} ${successCount} ${successCount === 1 ? "domain" : "domains"}`);
      },
      onError: (err, variables) => {
        toast.error({
          title: variables.muted ? "Mute failed" : "Unmute failed",
          message: err.message,
        });
      },
      onSettled: async () => {
        await invalidate();
        overflowSheetRef.current?.close();
        exitSelection();
      },
    }),
  );

  const overLimit = count > BULK_LIMIT;
  const busy = archive.isPending || remove.isPending || setMuted.isPending;
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

  const handleSetMuted = (muted: boolean) => {
    if (busy) return;
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    setMuted.mutate({ muted, trackedDomainIds: ids });
  };

  return (
    <>
      <Animated.View
        style={[
          {
            bottom: insets.bottom + 12,
            left: 12,
            pointerEvents: mode === "selecting" ? "auto" : "none",
            position: "absolute",
            right: 12,
          },
          animatedStyle,
        ]}
      >
        <View
          className="border-line bg-glass gap-2 rounded-2xl border p-3"
          style={{ borderCurve: "continuous" }}
        >
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-row items-center gap-3">
              {Platform.OS === "android" ? (
                <Pressable accessibilityRole="button" hitSlop={8} onPress={exitSelection}>
                  <Text className="text-brand text-base font-semibold">Done</Text>
                </Pressable>
              ) : null}
              <Text className="text-sm font-semibold tabular-nums">{count} selected</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <OverflowButton
                disabled={disabled}
                onPress={() => overflowSheetRef.current?.present()}
              />
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
      <AppBottomSheet
        description="Apply a change to all selected domains."
        ref={overflowSheetRef}
        snapPoints={["40%"]}
        title="More actions"
      >
        <View className="gap-3">
          <GlassCard>
            <View className="gap-1">
              <Text className="font-semibold">Mute notifications</Text>
              <MutedText>
                Suppress in-app, email, and push alerts for the selected domains.
              </MutedText>
            </View>
            <Button
              disabled={busy || count === 0}
              loading={setMuted.isPending && setMuted.variables?.muted === true}
              onPress={() => handleSetMuted(true)}
              variant="secondary"
            >
              <Text>Mute {count}</Text>
            </Button>
          </GlassCard>
          <GlassCard>
            <View className="gap-1">
              <Text className="font-semibold">Unmute notifications</Text>
              <MutedText>Resume alerts for the selected domains.</MutedText>
            </View>
            <Button
              disabled={busy || count === 0}
              loading={setMuted.isPending && setMuted.variables?.muted === false}
              onPress={() => handleSetMuted(false)}
              variant="secondary"
            >
              <Text>Unmute {count}</Text>
            </Button>
          </GlassCard>
        </View>
      </AppBottomSheet>
    </>
  );
}

function OverflowButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  const iconColor = useCSSVariable("--color-text") as string;
  return (
    <Pressable
      accessibilityLabel="More actions"
      accessibilityRole="button"
      className="border-line h-9 w-9 items-center justify-center rounded-xl border"
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <MaterialIcons color={iconColor} name="more-horiz" size={20} />
    </Pressable>
  );
}
