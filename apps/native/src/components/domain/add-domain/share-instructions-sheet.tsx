import { useMutation } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { useEffect, useReducer, useRef, useState } from "react";
import { Share, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { AppBottomSheet, type AppBottomSheetRef } from "@/components/bottom-sheet";
import { Button } from "@/components/button";
import { GlassCard } from "@/components/glass-card";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useTRPC } from "@/lib/api";
import { toast } from "@/lib/toast";
import { formatInstructionsForSharing } from "@domainstack/utils/verification";

type EmailStatus = "idle" | "sending" | "sent";

type SheetState = { email: string; emailStatus: EmailStatus };

type SheetAction =
  | { type: "setEmail"; email: string }
  | { type: "sending" }
  | { type: "sent" }
  | { type: "reset" };

const initialState: SheetState = { email: "", emailStatus: "idle" };

function reducer(state: SheetState, action: SheetAction): SheetState {
  switch (action.type) {
    case "setEmail":
      return { ...state, email: action.email };
    case "sending":
      return { ...state, emailStatus: "sending" };
    case "sent":
      return { ...state, emailStatus: "sent" };
    case "reset":
      return initialState;
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ShareInstructionsSheet({
  domain,
  onOpenChange,
  open,
  trackedDomainId,
  verificationToken,
}: {
  domain: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  trackedDomainId: string;
  verificationToken: string;
}) {
  const ref = useRef<AppBottomSheetRef>(null);
  const trpc = useTRPC();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [copied, setCopied] = useState(false);
  const successColor = useCSSVariable("--color-success") as string;
  const mutedColor = useCSSVariable("--color-muted-foreground") as string;
  const primaryForeground = useCSSVariable("--color-primary-foreground") as string;

  useEffect(() => {
    if (open) ref.current?.present();
    else ref.current?.dismiss();
  }, [open]);

  useEffect(() => {
    if (!open) {
      dispatch({ type: "reset" });
      setCopied(false);
    }
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const sendEmail = useMutation(
    trpc.tracking.sendVerificationInstructions.mutationOptions({
      onError: (error) => {
        dispatch({ type: "reset" });
        toast.error({ title: "Failed to send email", message: error.message });
      },
      onMutate: () => {
        dispatch({ type: "sending" });
        return undefined;
      },
      onSuccess: () => {
        dispatch({ type: "sent" });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    }),
  );

  const formatted = formatInstructionsForSharing(domain, verificationToken);
  const trimmedEmail = state.email.trim();
  const validEmail = EMAIL_REGEX.test(trimmedEmail);
  const sending = state.emailStatus === "sending";
  const sent = state.emailStatus === "sent";

  async function handleCopy() {
    await Clipboard.setStringAsync(formatted);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
  }

  function handleSystemShare() {
    void Share.share({ message: formatted });
  }

  function handleSend() {
    if (!validEmail || sending || sent) return;
    sendEmail.mutate({ recipientEmail: trimmedEmail, trackedDomainId });
  }

  return (
    <AppBottomSheet
      description="Send these instructions to someone who manages your domain — IT admin, web developer, or registrar contact."
      onDismiss={() => onOpenChange(false)}
      ref={ref}
      snapPoints={["65%", "92%"]}
      title="Share instructions"
    >
      <View className="gap-3">
        <GlassCard>
          <View className="flex-row items-start gap-3">
            <SymbolView
              name={{ ios: "doc.on.doc", android: "content_copy" }}
              size={20}
              tintColor={mutedColor}
            />
            <View className="flex-1 gap-1">
              <Text className="font-semibold">Copy to clipboard</Text>
              <Text className="text-sm text-muted-foreground">
                Paste the instructions wherever you need them.
              </Text>
            </View>
          </View>
          <Button onPress={() => void handleCopy()} variant="secondary">
            {copied ? (
              <>
                <SymbolView
                  name={{ ios: "checkmark", android: "check" }}
                  size={16}
                  tintColor={successColor}
                />
                <Text>Copied</Text>
              </>
            ) : (
              <Text>Copy</Text>
            )}
          </Button>
        </GlassCard>

        <GlassCard>
          <View className="flex-row items-start gap-3">
            <SymbolView
              name={{ ios: "square.and.arrow.up", android: "ios_share" }}
              size={20}
              tintColor={mutedColor}
            />
            <View className="flex-1 gap-1">
              <Text className="font-semibold">Share via system</Text>
              <Text className="text-sm text-muted-foreground">
                Open the iOS share sheet to send via Mail, Messages, and more.
              </Text>
            </View>
          </View>
          <Button onPress={handleSystemShare} variant="secondary">
            <Text>Share…</Text>
          </Button>
        </GlassCard>

        <GlassCard>
          <View className="flex-row items-start gap-3">
            <SymbolView
              name={{ ios: "at", android: "alternate_email" }}
              size={20}
              tintColor={mutedColor}
            />
            <View className="flex-1 gap-1">
              <Text className="font-semibold">Send via email</Text>
              <Text className="text-sm text-muted-foreground">
                We’ll email the instructions on your behalf.
              </Text>
            </View>
          </View>
          <TextField
            autoComplete="email"
            editable={!sending && !sent}
            inputMode="email"
            label="Recipient"
            onChangeText={(email) => dispatch({ type: "setEmail", email })}
            placeholder={`admin@${domain}`}
            returnKeyType="send"
            textContentType="emailAddress"
            value={state.email}
          />
          <Button disabled={!validEmail || sent} loading={sending} onPress={handleSend}>
            {sent ? (
              <>
                <SymbolView
                  name={{ ios: "checkmark", android: "check" }}
                  size={16}
                  tintColor={primaryForeground}
                />
                <Text>Sent</Text>
              </>
            ) : (
              <Text>Send</Text>
            )}
          </Button>
        </GlassCard>
      </View>
    </AppBottomSheet>
  );
}
