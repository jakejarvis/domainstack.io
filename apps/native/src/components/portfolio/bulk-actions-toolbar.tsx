import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
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
  const { t } = useLingui();
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
        title: t`Selection limit`,
        message: t`You can act on up to ${BULK_LIMIT} domains at once. Deselect some to continue.`,
      });
    } else if (!overLimit) {
      warnedRef.current = false;
    }
  }, [mode, overLimit, t]);

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
        toast.success(t`Archived ${plural(ids.length, { one: "# domain", other: "# domains" })}`);
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
      confirmLabel: t`Remove`,
      message: t`This permanently removes tracking and notification settings.`,
      title: t`Remove ${plural(count, { one: "# domain", other: "# domains" })}?`,
    }).then((confirmed) => {
      if (!confirmed) return;
      void dashboard.bulkRemove(ids).then(
        () => {
          toast.success(t`Removed ${plural(ids.length, { one: "# domain", other: "# domains" })}`);
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
        title: t`Too many selected`,
        message: t`Select up to ${BULK_LIMIT} domains at a time.`,
      });
      return;
    }
    void dashboard.bulkSetMuted(ids, muted).then(
      ({ successCount }) => {
        toast.success(
          muted
            ? t`Muted ${plural(successCount, { one: "# domain", other: "# domains" })}`
            : t`Unmuted ${plural(successCount, { one: "# domain", other: "# domains" })}`,
        );
        exitSelection();
      },
      () => exitSelection(),
    );
  };

  return (
    <Stack.Toolbar placement="bottom">
      <Stack.Toolbar.Button
        accessibilityLabel={t`Archive selected`}
        disabled={disabled}
        icon={Platform.OS === "ios" ? "archivebox" : undefined}
        onPress={handleArchive}
      >
        {t`Archive`}
      </Stack.Toolbar.Button>
      <Stack.Toolbar.Spacer />
      <Stack.Toolbar.Menu
        accessibilityLabel={t`More actions`}
        disabled={busy}
        icon={Platform.OS === "ios" ? "ellipsis.circle" : undefined}
      >
        <Stack.Toolbar.MenuAction
          icon={Platform.OS === "ios" ? "bell.slash" : undefined}
          onPress={() => handleSetMuted(true)}
        >
          {t`Mute notifications`}
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction
          icon={Platform.OS === "ios" ? "bell" : undefined}
          onPress={() => handleSetMuted(false)}
        >
          {t`Unmute notifications`}
        </Stack.Toolbar.MenuAction>
      </Stack.Toolbar.Menu>
      <Stack.Toolbar.Spacer />
      <Stack.Toolbar.Button
        accessibilityLabel={t`Remove selected`}
        disabled={disabled}
        icon={Platform.OS === "ios" ? "trash" : undefined}
        onPress={handleRemove}
      >
        {t`Remove`}
      </Stack.Toolbar.Button>
    </Stack.Toolbar>
  );
}
