import { Stack } from "expo-router/stack";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

import { useDashboardMutations } from "@/hooks/use-dashboard-mutations";
import {
  getSelectedIds,
  useSelectionActions,
  useSelectionCount,
  useSelectionMode,
} from "@/hooks/use-portfolio-selection";
import { confirmDestructive } from "@/lib/native-confirm";
import { toast } from "@/lib/toast";

const BULK_LIMIT = 100;

export function BulkActionsToolbar() {
  const mode = useSelectionMode();
  const count = useSelectionCount();
  const { exitSelection } = useSelectionActions();
  const dashboard = useDashboardMutations();

  const overLimit = count > BULK_LIMIT;

  // Surface the cap the moment selection crosses it — not only after the user
  // taps a now-disabled action. Warn once per crossing; re-arm when back under.
  const warnedRef = useRef(false);
  useEffect(() => {
    if (mode === "selecting" && overLimit && !warnedRef.current) {
      warnedRef.current = true;
      toast.warning({
        title: "Selection limit",
        message: `You can act on up to ${BULK_LIMIT} domains at once. Deselect some to continue.`,
      });
    } else if (!overLimit) {
      warnedRef.current = false;
    }
  }, [mode, overLimit]);

  if (mode !== "selecting") return null;

  const busy =
    dashboard.isBulkArchiving || dashboard.isBulkRemoving || dashboard.isBulkSettingMuted;
  const disabled = count === 0 || overLimit || busy;

  const handleArchive = () => {
    if (disabled) return;
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    void dashboard.bulkArchive(ids).then(
      () => {
        toast.success(`Archived ${ids.length} ${ids.length === 1 ? "domain" : "domains"}`);
        exitSelection();
      },
      () => exitSelection(),
    );
  };

  const handleRemove = () => {
    if (disabled) return;
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    void confirmDestructive({
      confirmLabel: "Remove",
      message: "This permanently removes tracking and notification settings.",
      title: `Remove ${count} ${count === 1 ? "domain" : "domains"}?`,
    }).then((confirmed) => {
      if (!confirmed) return;
      void dashboard.bulkRemove(ids).then(
        () => {
          toast.success(`Removed ${ids.length} ${ids.length === 1 ? "domain" : "domains"}`);
          exitSelection();
        },
        () => exitSelection(),
      );
    });
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
    void dashboard.bulkSetMuted(ids, muted).then(
      ({ successCount }) => {
        const verb = muted ? "Muted" : "Unmuted";
        toast.success(`${verb} ${successCount} ${successCount === 1 ? "domain" : "domains"}`);
        exitSelection();
      },
      () => exitSelection(),
    );
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
