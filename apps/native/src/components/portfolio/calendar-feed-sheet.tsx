import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import type { Ref } from "react";
import { Alert, ScrollView, View } from "react-native";

import { AppBottomSheet, type AppBottomSheetRef } from "@/components/bottom-sheet";
import { Button } from "@/components/button";
import { GlassCard } from "@/components/glass-card";
import { Spinner } from "@/components/spinner";
import { MutedText, Text } from "@/components/text";
import { useTRPC } from "@/lib/api";
import { toast } from "@/lib/toast";

function toWebcalUrl(httpsUrl: string): string {
  return httpsUrl.replace(/^https?:/i, "webcal:");
}

export function CalendarFeedSheet({ ref }: { ref?: Ref<AppBottomSheetRef> }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const feedKey = trpc.user.getCalendarFeed.queryKey();
  const feedQuery = useQuery(trpc.user.getCalendarFeed.queryOptions());

  const invalidate = () => queryClient.invalidateQueries({ queryKey: feedKey });

  const enable = useMutation(
    trpc.user.enableCalendarFeed.mutationOptions({
      onError: (error) => toast.error({ title: "Could not enable feed", message: error.message }),
      onSettled: invalidate,
    }),
  );

  const disable = useMutation(
    trpc.user.disableCalendarFeed.mutationOptions({
      onError: (error) => toast.error({ title: "Could not disable feed", message: error.message }),
      onSettled: invalidate,
    }),
  );

  const rotate = useMutation(
    trpc.user.rotateCalendarFeedToken.mutationOptions({
      onSuccess: () => toast.success("Feed URL rotated"),
      onError: (error) => toast.error({ title: "Could not rotate URL", message: error.message }),
      onSettled: invalidate,
    }),
  );

  const remove = useMutation(
    trpc.user.deleteCalendarFeed.mutationOptions({
      onError: (error) => toast.error({ title: "Could not delete feed", message: error.message }),
      onSettled: invalidate,
    }),
  );

  const busy = enable.isPending || disable.isPending || rotate.isPending || remove.isPending;
  const feed = feedQuery.data;
  const enabled = feed?.enabled === true;
  const feedUrl = enabled ? feed.feedUrl : null;

  async function handleCopy() {
    if (!feedUrl) return;
    await Clipboard.setStringAsync(feedUrl);
    toast.success({ title: "Copied", message: "Feed URL copied to clipboard." });
  }

  function handleSubscribe() {
    if (!feedUrl) return;
    void Linking.openURL(toWebcalUrl(feedUrl));
  }

  function handleRotate() {
    Alert.alert(
      "Generate new URL?",
      "The current URL stops working immediately. Any subscribed calendar apps need to resubscribe.",
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: () => rotate.mutate(undefined),
          style: "destructive",
          text: "Rotate",
        },
      ],
    );
  }

  function handleDisable() {
    Alert.alert(
      "Disable feed?",
      "Subscribed calendars will stop receiving updates. You can re-enable later with the same URL.",
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: () => disable.mutate(undefined),
          text: "Disable",
        },
      ],
    );
  }

  function handleDelete() {
    Alert.alert(
      "Delete feed?",
      "This permanently removes the feed and any subscribed calendars will stop syncing.",
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: () => remove.mutate(undefined),
          style: "destructive",
          text: "Delete",
        },
      ],
    );
  }

  return (
    <AppBottomSheet
      description="Subscribe to a read-only calendar of your domain expiries."
      ref={ref}
      title="Calendar feed"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        {feedQuery.isPending ? (
          <View className="items-center py-6">
            <Spinner />
          </View>
        ) : feedQuery.error ? (
          <GlassCard>
            <Text className="font-semibold">Feed unavailable</Text>
            <MutedText>{feedQuery.error.message}</MutedText>
            <Button onPress={() => void feedQuery.refetch()} variant="secondary">
              <Text>Retry</Text>
            </Button>
          </GlassCard>
        ) : enabled && feedUrl ? (
          <>
            <GlassCard>
              <Text className="font-semibold">Feed URL</Text>
              <MutedText className="font-mono text-xs" numberOfLines={3} selectable>
                {feedUrl}
              </MutedText>
              <View className="flex-row gap-2">
                <Button className="flex-1" onPress={handleCopy} variant="secondary">
                  <Text>Copy</Text>
                </Button>
                <Button className="flex-1" onPress={handleSubscribe}>
                  <Text>Subscribe</Text>
                </Button>
              </View>
            </GlassCard>
            <GlassCard>
              <Text className="font-semibold">Manage</Text>
              <Button
                disabled={busy}
                loading={rotate.isPending}
                onPress={handleRotate}
                variant="secondary"
              >
                <Text>Rotate URL</Text>
              </Button>
              <Button
                disabled={busy}
                loading={disable.isPending}
                onPress={handleDisable}
                variant="secondary"
              >
                <Text>Disable feed</Text>
              </Button>
              <Button
                disabled={busy}
                loading={remove.isPending}
                onPress={handleDelete}
                variant="danger"
              >
                <Text>Delete feed</Text>
              </Button>
            </GlassCard>
          </>
        ) : (
          <GlassCard>
            <Text className="font-semibold">Feed not set up</Text>
            <MutedText>
              Enable to generate a private webcal URL. Subscribe in Apple Calendar, Google Calendar,
              or any standards-compliant client to see expiries.
            </MutedText>
            <Button
              disabled={busy}
              loading={enable.isPending}
              onPress={() => enable.mutate(undefined)}
            >
              <Text>Enable</Text>
            </Button>
          </GlassCard>
        )}
      </ScrollView>
    </AppBottomSheet>
  );
}
