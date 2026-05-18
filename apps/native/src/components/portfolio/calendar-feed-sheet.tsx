import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { type Ref, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { AppBottomSheet, type AppBottomSheetRef } from "@/components/bottom-sheet";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Spinner } from "@/components/spinner";
import { Text } from "@/components/text";
import { analytics } from "@/lib/analytics";
import { useTRPC } from "@/lib/api";
import {
  type CalendarPermissionStatus,
  ensurePermission,
  reconcile,
  teardown,
} from "@/lib/calendar-sync";
import { confirm, confirmDestructive } from "@/lib/native-confirm";
import { useCalendarSyncStore } from "@/lib/stores/calendar-sync-store";
import { toast } from "@/lib/toast";
import { formatRelativeTime } from "@domainstack/utils/relative-time";

function toWebcalUrl(httpsUrl: string): string {
  return httpsUrl.replace(/^https?:/i, "webcal:");
}

function pluralizeExpirations(count: number): string {
  return `${count} ${count === 1 ? "expiration" : "expirations"}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Please try again.";
}

/**
 * Shown whenever we couldn't get calendar access ourselves. `blocked` means
 * the OS won't let us prompt again, so deep-linking to the system Settings app
 * is the only way the user can grant it.
 */
function PermissionNotice({ status }: { status: Exclude<CalendarPermissionStatus, "granted"> }) {
  return (
    <View className="gap-2">
      <Text className="text-sm text-destructive">
        {status === "blocked"
          ? "Calendar access is currently disabled. Enable it in Settings and try again."
          : "Calendar access was declined. Turn it on in Settings, then try again."}
      </Text>
      <Button onPress={() => void Linking.openSettings()} variant="secondary">
        <Text>Open Settings</Text>
      </Button>
    </View>
  );
}

export function CalendarFeedSheet({ ref }: { ref?: Ref<AppBottomSheetRef> }) {
  return (
    <AppBottomSheet
      description="Add your domain expirations to your phone's calendar."
      ref={ref}
      title="Calendar"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        <ManagedCalendarCard />
        <AdvancedSubscriptionSection />
      </ScrollView>
    </AppBottomSheet>
  );
}

function ManagedCalendarCard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const enabled = useCalendarSyncStore((s) => s.enabled);
  const lastSyncedAt = useCalendarSyncStore((s) => s.lastSyncedAt);
  const syncedCount = useCalendarSyncStore((s) => Object.keys(s.eventMap).length);
  const setEnabled = useCalendarSyncStore((s) => s.setEnabled);

  const [adding, setAdding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [removing, setRemoving] = useState(false);
  // Non-null whenever we couldn't obtain access ourselves; "blocked" means the
  // OS won't prompt anymore so Settings is the only way back.
  const [permissionIssue, setPermissionIssue] = useState<Exclude<
    CalendarPermissionStatus,
    "granted"
  > | null>(null);

  const busy = adding || syncing || removing;

  async function getDomains() {
    return queryClient.ensureQueryData(
      trpc.tracking.listDomains.queryOptions({ includeArchived: false }),
    );
  }

  async function handleAdd() {
    setAdding(true);
    try {
      const status = await ensurePermission();
      if (status !== "granted") {
        setPermissionIssue(status);
        return;
      }
      setPermissionIssue(null);
      const count = await reconcile(await getDomains());
      setEnabled(true);
      toast.success({
        title: "Added to calendar",
        message: `Added ${pluralizeExpirations(count)} to your calendar.`,
      });
    } catch (error) {
      analytics.trackException(error, { context: "calendar-add" });
      toast.error({ title: "Couldn't add to calendar", message: errorMessage(error) });
    } finally {
      setAdding(false);
    }
  }

  async function handleSyncNow() {
    setSyncing(true);
    try {
      // Access can be revoked in Settings while sync stays "enabled". Re-check
      // (and re-prompt where allowed) so a revoked grant surfaces the Settings
      // link instead of a dead-end "sync failed" toast.
      const status = await ensurePermission();
      if (status !== "granted") {
        setPermissionIssue(status);
        return;
      }
      setPermissionIssue(null);
      const count = await reconcile(await getDomains());
      toast.success(`${pluralizeExpirations(count)} synced`);
    } catch (error) {
      analytics.trackException(error, { context: "calendar-sync-now" });
      toast.error({ title: "Sync failed", message: errorMessage(error) });
    } finally {
      setSyncing(false);
    }
  }

  function handleRemove() {
    void confirmDestructive({
      confirmLabel: "Remove",
      message:
        "Deletes the Domainstack calendar and its events from this device. Your tracked domains aren't affected.",
      title: "Remove from calendar?",
    }).then(async (confirmed) => {
      if (!confirmed) return;
      setRemoving(true);
      try {
        await teardown();
        toast.success("Removed from calendar");
      } catch (error) {
        analytics.trackException(error, { context: "calendar-teardown" });
        toast.error({ title: "Couldn't remove", message: errorMessage(error) });
      } finally {
        setRemoving(false);
      }
    });
  }

  if (enabled) {
    const relative = lastSyncedAt ? formatRelativeTime(lastSyncedAt) : null;
    return (
      <Card>
        <Text className="font-semibold">Added to your calendar</Text>
        <Text className="text-sm text-muted-foreground">
          {pluralizeExpirations(syncedCount)}
          {relative ? ` · updated ${relative}` : ""}
        </Text>
        {permissionIssue ? <PermissionNotice status={permissionIssue} /> : null}
        <Button disabled={busy} loading={syncing} onPress={handleSyncNow} variant="secondary">
          <Text>Sync now</Text>
        </Button>
        <Button disabled={busy} loading={removing} onPress={handleRemove} variant="danger">
          <Text>Remove from calendar</Text>
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <Text className="font-semibold">Add to your calendar</Text>
      <Text className="text-sm text-muted-foreground">
        Adds an all-day event for each verified domain's expiration to a dedicated “Domainstack”
        calendar on this device. It stays in sync automatically as your portfolio changes.
      </Text>
      {permissionIssue ? <PermissionNotice status={permissionIssue} /> : null}
      <Button disabled={busy} loading={adding} onPress={handleAdd}>
        <Text>Add to Calendar</Text>
      </Button>
    </Card>
  );
}

function AdvancedSubscriptionSection() {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <Pressable
        accessibilityHint="Cross-device webcal subscription for desktop calendar apps"
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        className="flex-row items-center justify-between"
        onPress={() => setExpanded((v) => !v)}
      >
        <Text className="font-semibold">Subscription URL (advanced)</Text>
        <Text className="text-muted-foreground">{expanded ? "▾" : "▸"}</Text>
      </Pressable>
      {expanded ? <SubscriptionFeedManager /> : null}
    </Card>
  );
}

function SubscriptionFeedManager() {
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

  if (feedQuery.isPending) {
    return (
      <View className="items-center py-6">
        <Spinner />
      </View>
    );
  }

  if (feedQuery.error) {
    return (
      <View className="gap-2">
        <Text className="text-sm text-muted-foreground">{feedQuery.error.message}</Text>
        <Button onPress={() => void feedQuery.refetch()} variant="secondary">
          <Text>Retry</Text>
        </Button>
      </View>
    );
  }

  if (enabled && feedUrl) {
    return (
      <View className="gap-3">
        <Text className="text-sm text-muted-foreground">
          Subscribe in a desktop calendar app for read-only, cross-device sync.
        </Text>
        <Text className="font-mono text-xs text-muted-foreground" numberOfLines={3} selectable>
          {feedUrl}
        </Text>
        <View className="flex-row gap-2">
          <Button className="flex-1" onPress={handleCopy} variant="secondary">
            <Text>Copy</Text>
          </Button>
          <Button className="flex-1" onPress={handleSubscribe} variant="secondary">
            <Text>Subscribe</Text>
          </Button>
        </View>
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
        <Button disabled={busy} loading={remove.isPending} onPress={handleDelete} variant="danger">
          <Text>Delete feed</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <Text className="text-sm text-muted-foreground">
        Generates a private webcal URL to subscribe in Apple Calendar, Google Calendar, or any
        standards-compliant client.
      </Text>
      <Button disabled={busy} loading={enable.isPending} onPress={() => enable.mutate(undefined)}>
        <Text>Enable</Text>
      </Button>
    </View>
  );
}
