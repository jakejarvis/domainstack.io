import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router/stack";
import { Alert, Platform } from "react-native";

import {
  getSelectedIds,
  useSelectionActions,
  useSelectionCount,
  useSelectionMode,
} from "@/hooks/use-portfolio-selection";
import { useTRPC } from "@/lib/api";
import { toast } from "@/lib/toast";

const BULK_LIMIT = 100;

export function BulkActionsToolbar() {
  const mode = useSelectionMode();
  const count = useSelectionCount();
  const { exitSelection } = useSelectionActions();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

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
        exitSelection();
      },
    }),
  );

  if (mode !== "selecting") return null;

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
    if (overLimit) {
      toast.warning({
        title: "Too many selected",
        message: `Select up to ${BULK_LIMIT} domains at a time.`,
      });
      return;
    }
    setMuted.mutate({ muted, trackedDomainIds: ids });
  };

  return (
    <Stack.Toolbar placement="bottom">
      <Stack.Toolbar.Button
        accessibilityLabel="Archive selected"
        disabled={disabled}
        icon={Platform.OS === "ios" ? "archivebox" : undefined}
        onPress={handleArchive}
      >
        Archive
      </Stack.Toolbar.Button>
      <Stack.Toolbar.Spacer />
      <Stack.Toolbar.Menu
        accessibilityLabel="More actions"
        disabled={busy}
        icon={Platform.OS === "ios" ? "ellipsis.circle" : undefined}
      >
        <Stack.Toolbar.MenuAction
          icon={Platform.OS === "ios" ? "bell.slash" : undefined}
          onPress={() => handleSetMuted(true)}
        >
          Mute notifications
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction
          icon={Platform.OS === "ios" ? "bell" : undefined}
          onPress={() => handleSetMuted(false)}
        >
          Unmute notifications
        </Stack.Toolbar.MenuAction>
      </Stack.Toolbar.Menu>
      <Stack.Toolbar.Spacer />
      <Stack.Toolbar.Button
        accessibilityLabel="Remove selected"
        disabled={disabled}
        icon={Platform.OS === "ios" ? "trash" : undefined}
        onPress={handleRemove}
      >
        Remove
      </Stack.Toolbar.Button>
    </Stack.Toolbar>
  );
}
