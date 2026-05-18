import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { View } from "react-native";

import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Spinner } from "@/components/spinner";
import { Text } from "@/components/text";
import { analytics } from "@/lib/analytics";
import { useTRPC } from "@/lib/api";
import { deleteAccount } from "@/lib/auth";
import { raceUnregister, resolveTokenToUnregister } from "@/lib/push-unregister";
import { usePushPromptStore } from "@/lib/stores/push-prompt-store";

type State = { status: "loading" } | { status: "success" } | { status: "error"; message: string };

type Action = { type: "RETRY" } | { type: "SUCCESS" } | { type: "ERROR"; message: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "RETRY":
      return { status: "loading" };
    case "SUCCESS":
      return { status: "success" };
    case "ERROR":
      return { status: "error", message: action.message };
    default:
      return state;
  }
}

// This screen auto-initiates deletion on mount. It is ONLY reachable from
// `DeleteAccountRow`, which gates navigation behind a destructive confirm
// dialog — keep it that way (no other route should push here).
export default function DeleteAccountScreen() {
  const [state, dispatch] = useReducer(reducer, { status: "loading" });
  const trpc = useTRPC();
  const unregisterDevice = useMutation(trpc.user.unregisterPushDevice.mutationOptions());

  const mountedRef = useRef(true);
  const startedRef = useRef(false);
  const inFlightRef = useRef(false);
  const analyticsFiredRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runDeletion = useCallback(async () => {
    // Idempotent: an in-flight run (or a retry tapped twice) must not stack
    // requests or re-fire analytics.
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    if (!analyticsFiredRef.current) {
      analyticsFiredRef.current = true;
      analytics.track("delete_account_initiated");
    }

    // Best-effort push cleanup. A failure here must NEVER surface as a
    // deletion failure — the account is still fully intact, and an orphaned
    // push row is reconciled server-side after the account is gone.
    try {
      const token = await resolveTokenToUnregister();
      if (token) {
        await raceUnregister(unregisterDevice.mutateAsync({ expoPushToken: token }));
      }
      usePushPromptStore.getState().setLastRegisteredToken(null);
    } catch {
      // swallow — see comment above
    }

    try {
      const result = await deleteAccount();
      if (!mountedRef.current) return;
      if (result.error) {
        dispatch({
          message: result.error.message ?? "Failed to request account deletion.",
          type: "ERROR",
        });
        return;
      }
      dispatch({ type: "SUCCESS" });
    } catch (error) {
      if (!mountedRef.current) return;
      dispatch({
        message: error instanceof Error ? error.message : "An unexpected error occurred.",
        type: "ERROR",
      });
    } finally {
      inFlightRef.current = false;
    }
  }, [unregisterDevice]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void runDeletion();
  }, [runDeletion]);

  const retry = useCallback(() => {
    dispatch({ type: "RETRY" });
    void runDeletion();
  }, [runDeletion]);

  return (
    <Screen>
      {state.status === "loading" ? (
        <View className="items-center gap-3 py-12">
          <Spinner />
          <Text className="text-sm text-muted-foreground">Sending confirmation email…</Text>
        </View>
      ) : null}

      {state.status === "success" ? (
        <View className="gap-4">
          <Text variant="title2">Check your email</Text>
          <Text className="text-sm text-muted-foreground">
            We’ve sent a confirmation link to your email address. Click the link to permanently
            delete your account.
          </Text>
          <Button onPress={() => router.back()}>
            <Text>Close</Text>
          </Button>
        </View>
      ) : null}

      {state.status === "error" ? (
        <View className="gap-4">
          <Text variant="title2">Deletion failed</Text>
          <Text className="text-sm text-destructive">{state.message}</Text>
          <View className="flex-row gap-2">
            <Button className="flex-1" onPress={() => router.back()} variant="secondary">
              <Text>Cancel</Text>
            </Button>
            <Button className="flex-1" onPress={retry} variant="danger">
              <Text>Try again</Text>
            </Button>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
