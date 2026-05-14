import * as Notifications from "expo-notifications";
import { useCallback } from "react";

import { usePushRegistration } from "@/hooks/use-push-registration";
import { type PushPromptTrigger, usePushPromptStore } from "@/lib/stores/push-prompt-store";

export function usePushSoftPrompt() {
  const { register } = usePushRegistration();

  return useCallback(
    async (context: PushPromptTrigger) => {
      const { status } = await Notifications.getPermissionsAsync();
      const store = usePushPromptStore.getState();

      // Already granted — silently refresh the token (handles reinstall + token rotation)
      // regardless of whether this trigger was previously handled.
      if (status === "granted") {
        store.markTriggerHandled(context);
        try {
          await register();
        } catch {
          // Swallow: settings has a manual "Register this device" fallback.
        }
        return;
      }

      // Pre-hydration the persisted handledTriggers list is empty; trusting it
      // would falsely mark this trigger handled and suppress the prompt for the
      // rest of the session. Caller can re-trigger after hydration finishes.
      if (!store.hasHydrated) return;

      if (store.isTriggerHandled(context)) return;
      store.markTriggerHandled(context);

      // Denied: OS won't show the dialog again — sending users to Settings is a separate flow.
      if (status === "denied") return;

      // Undetermined: show the soft pre-prompt before burning the OS dialog.
      store.open();
    },
    [register],
  );
}
