import { useEffect, useReducer, useRef } from "react";
import { View } from "react-native";

import { AppBottomSheet, type AppBottomSheetRef } from "@/components/bottom-sheet";
import { Button } from "@/components/button";
import { GlassCard } from "@/components/glass-card";
import { Spinner } from "@/components/spinner";
import { MutedText, Text } from "@/components/text";
import { analytics } from "@/lib/analytics";
import { deleteAccount } from "@/lib/auth";

type DialogState =
  | { status: "confirm" }
  | { status: "loading" }
  | { status: "success" }
  | { status: "error"; message: string };

type DialogAction =
  | { type: "START_DELETE" }
  | { type: "DELETE_SUCCESS" }
  | { type: "DELETE_ERROR"; message: string }
  | { type: "RESET" };

const initialState: DialogState = { status: "confirm" };

function reducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case "START_DELETE":
      return { status: "loading" };
    case "DELETE_SUCCESS":
      return { status: "success" };
    case "DELETE_ERROR":
      return { status: "error", message: action.message };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export function DeleteAccountSection() {
  const [open, setOpen] = useReducer((_prev: boolean, next: boolean) => next, false);
  const [state, dispatch] = useReducer(reducer, initialState);
  const sheetRef = useRef<AppBottomSheetRef>(null);

  useEffect(() => {
    if (open) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [open]);

  async function handleDelete() {
    analytics.track("delete_account_initiated");
    dispatch({ type: "START_DELETE" });
    try {
      const result = await deleteAccount();
      if (result.error) {
        dispatch({
          type: "DELETE_ERROR",
          message: result.error.message ?? "Failed to request account deletion.",
        });
        return;
      }
      dispatch({ type: "DELETE_SUCCESS" });
    } catch (error) {
      dispatch({
        type: "DELETE_ERROR",
        message: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  }

  function handleSheetDismiss() {
    setOpen(false);
    dispatch({ type: "RESET" });
  }

  return (
    <GlassCard>
      <Text className="text-xl font-semibold">Danger zone</Text>
      <MutedText>
        Deletes your account, tracked domains, notification preferences, and any active
        subscription. This action cannot be undone.
      </MutedText>
      <Button onPress={() => setOpen(true)} variant="danger">
        <Text>Delete account</Text>
      </Button>
      <AppBottomSheet
        onDismiss={handleSheetDismiss}
        ref={sheetRef}
        snapPoints={["55%"]}
        title={state.status === "success" ? "Check your email" : "Delete your account?"}
      >
        {state.status === "success" ? (
          <View className="gap-3">
            <MutedText>
              We&apos;ve sent a confirmation link to your email address. Click the link to
              permanently delete your account.
            </MutedText>
            <Button onPress={() => setOpen(false)} variant="secondary">
              <Text>Close</Text>
            </Button>
          </View>
        ) : state.status === "loading" ? (
          <View className="items-center gap-3 py-6">
            <Spinner />
            <MutedText>Sending confirmation email…</MutedText>
          </View>
        ) : (
          <View className="gap-3">
            <MutedText>This action cannot be undone. The following will be deleted:</MutedText>
            <View className="gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3">
              <MutedText>• All your tracked domains</MutedText>
              <MutedText>• Notification preferences and push devices</MutedText>
              <MutedText>• Active subscription</MutedText>
              <MutedText>• Linked sign-in accounts</MutedText>
            </View>
            {state.status === "error" ? (
              <MutedText className="text-danger">{state.message}</MutedText>
            ) : null}
            <View className="flex-row gap-2">
              <Button className="flex-1" onPress={() => setOpen(false)} variant="secondary">
                <Text>Cancel</Text>
              </Button>
              <Button className="flex-1" onPress={() => void handleDelete()} variant="danger">
                <Text>Delete</Text>
              </Button>
            </View>
          </View>
        )}
      </AppBottomSheet>
    </GlassCard>
  );
}
