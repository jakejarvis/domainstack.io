import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import type { Ref } from "react";
import { ScrollView, View } from "react-native";

import { AppBottomSheet, type AppBottomSheetRef } from "@/components/bottom-sheet";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Spinner } from "@/components/spinner";
import { Text } from "@/components/text";
import { useTRPC } from "@/lib/api";
import { confirm, confirmDestructive } from "@/lib/native-confirm";
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
    void confirmDestructive({
      confirmLabel: "Rotate",
      message:
        "The current URL stops working immediately. Any subscribed calendar apps need to resubscribe.",
      title: "Generate new URL?",
    }).then((confirmed) => {
      if (confirmed) rotate.mutate(undefined);
    });
  }

  function handleDisable() {
    void confirm({
      confirmLabel: "Disable",
      message:
        "Subscribed calendars will stop receiving updates. You can re-enable later with the same URL.",
      title: "Disable feed?",
    }).then((confirmed) => {
      if (confirmed) disable.mutate(undefined);
    });
  }

  function handleDelete() {
    void confirmDestructive({
      confirmLabel: "Delete",
      message: "This permanently removes the feed and any subscribed calendars will stop syncing.",
      title: "Delete feed?",
    }).then((confirmed) => {
      if (confirmed) remove.mutate(undefined);
    });
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
          <Card>
            <Text className="font-semibold">Feed unavailable</Text>
            <Text className="text-sm text-muted-foreground">{feedQuery.error.message}</Text>
            <Button onPress={() => void feedQuery.refetch()} variant="secondary">
              <Text>Retry</Text>
            </Button>
          </Card>
        ) : enabled && feedUrl ? (
          <>
            <Card>
              <Text className="font-semibold">Feed URL</Text>
              <Text
                className="font-mono text-xs text-muted-foreground"
                numberOfLines={3}
                selectable
              >
                {feedUrl}
              </Text>
              <View className="flex-row gap-2">
                <Button className="flex-1" onPress={handleCopy} variant="secondary">
                  <Text>Copy</Text>
                </Button>
                <Button className="flex-1" onPress={handleSubscribe}>
                  <Text>Subscribe</Text>
                </Button>
              </View>
            </Card>
            <Card>
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
            </Card>
          </>
        ) : (
          <Card>
            <Text className="font-semibold">Feed not set up</Text>
            <Text className="text-sm text-muted-foreground">
              Enable to generate a private webcal URL. Subscribe in Apple Calendar, Google Calendar,
              or any standards-compliant client to see expiries.
            </Text>
            <Button
              disabled={busy}
              loading={enable.isPending}
              onPress={() => enable.mutate(undefined)}
            >
              <Text>Enable</Text>
            </Button>
          </Card>
        )}
      </ScrollView>
    </AppBottomSheet>
  );
}
