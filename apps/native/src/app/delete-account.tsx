import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useReducer, useRef } from "react";
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

export default function DeleteAccountScreen() {
  const [state, dispatch] = useReducer(reducer, { status: "loading" });
  const startedRef = useRef(false);
  const trpc = useTRPC();
  const unregisterDevice = useMutation(trpc.user.unregisterPushDevice.mutationOptions());

  useEffect(() => {
    if (startedRef.current && state.status !== "loading") return;
    startedRef.current = true;
    let cancelled = false;
    void (async () => {
      analytics.track("delete_account_initiated");
      try {
        // Unregister this device's push token before deletion so the server
        // doesn't leave an orphan row referencing a soon-to-be-deleted user.
        const token = await resolveTokenToUnregister();
        if (token) {
          await raceUnregister(unregisterDevice.mutateAsync({ expoPushToken: token }));
        }
        usePushPromptStore.getState().setLastRegisteredToken(null);

        const result = await deleteAccount();
        if (cancelled) return;
        if (result.error) {
          dispatch({
            message: result.error.message ?? "Failed to request account deletion.",
            type: "ERROR",
          });
          return;
        }
        dispatch({ type: "SUCCESS" });
      } catch (error) {
        if (cancelled) return;
        dispatch({
          message: error instanceof Error ? error.message : "An unexpected error occurred.",
          type: "ERROR",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.status, unregisterDevice]);

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
            We&apos;ve sent a confirmation link to your email address. Click the link to permanently
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
            <Button className="flex-1" onPress={() => dispatch({ type: "RETRY" })} variant="danger">
              <Text>Try again</Text>
            </Button>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
