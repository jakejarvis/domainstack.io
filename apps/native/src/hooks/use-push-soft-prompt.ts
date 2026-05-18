import { useCallback } from "react";

import { usePushRegistration } from "@/hooks/use-push-registration";
import { getPushPermissionStatus } from "@/lib/push";
import { type PushPromptTrigger, usePushPromptStore } from "@/lib/stores/push-prompt-store";

export function usePushSoftPrompt() {
  const { register } = usePushRegistration();

  return useCallback(
    async (context: PushPromptTrigger) => {
      const status = await getPushPermissionStatus();
      const store = usePushPromptStore.getState();

      // Already granted — silently refresh the token (handles reinstall + token
      // rotation) regardless of whether this trigger was previously handled.
      // `register()` is total, so no try/catch is needed.
      if (status === "granted") {
        store.markTriggerHandled(context);
        await register();
        return;
      }

      // Pre-hydration the persisted handledTriggers list is empty; trusting it
      // would falsely mark this trigger handled and suppress the prompt for the
      // rest of the session. Caller can re-trigger after hydration finishes.
      if (!store.hasHydrated) return;

      if (store.isTriggerHandled(context)) return;
      store.markTriggerHandled(context);

      // Undetermined → the sheet shows the soft pre-prompt before burning the
      // OS dialog. Denied → the sheet shows an "Open Settings" recovery (the OS
      // won't prompt again, and a single mis-tap must not permanently kill a
      // core feature). Gated by markTriggerHandled, so it appears at most once
      // per trigger — not naggy.
      store.open();
    },
    [register],
  );
}
