import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useEffect, useReducer, useRef, useState } from "react";
import { Share, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { AppBottomSheet, type AppBottomSheetRef } from "@/components/bottom-sheet";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Symbol } from "@/components/symbol";
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
  const { t } = useLingui();
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
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const sendEmail = useMutation(
    trpc.tracking.sendVerificationInstructions.mutationOptions({
      onError: (error) => {
        dispatch({ type: "reset" });
        toast.error({ title: t`Failed to send email`, message: error.message });
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
      description={t`Send these instructions to someone who manages your domain — IT admin, web developer, or registrar contact.`}
      onDismiss={() => onOpenChange(false)}
      ref={ref}
      snapPoints={["65%", "92%"]}
      title={t`Share instructions`}
    >
      <View className="gap-3">
        <Card>
          <View className="flex-row items-start gap-3">
            <Symbol
              color={mutedColor}
              name={{ android: "content_copy", ios: "doc.on.doc" }}
              size={20}
            />
            <View className="flex-1 gap-1">
              <Text className="font-semibold">
                <Trans>Copy to clipboard</Trans>
              </Text>
              <Text className="text-sm text-muted-foreground">
                <Trans>Paste the instructions wherever you need them.</Trans>
              </Text>
            </View>
          </View>
          <Button onPress={() => void handleCopy()} variant="secondary">
            {copied ? (
              <>
                <Symbol
                  color={successColor}
                  name={{ android: "check", ios: "checkmark" }}
                  size={16}
                />
                <Text>
                  <Trans>Copied</Trans>
                </Text>
              </>
            ) : (
              <Text>
                <Trans>Copy</Trans>
              </Text>
            )}
          </Button>
        </Card>

        <Card>
          <View className="flex-row items-start gap-3">
            <Symbol
              color={mutedColor}
              name={{ android: "ios_share", ios: "square.and.arrow.up" }}
              size={20}
            />
            <View className="flex-1 gap-1">
              <Text className="font-semibold">
                <Trans>Share via system</Trans>
              </Text>
              <Text className="text-sm text-muted-foreground">
                <Trans>Open the iOS share sheet to send via Mail, Messages, and more.</Trans>
              </Text>
            </View>
          </View>
          <Button onPress={handleSystemShare} variant="secondary">
            <Text>
              <Trans>Share…</Trans>
            </Text>
          </Button>
        </Card>

        <Card>
          <View className="flex-row items-start gap-3">
            <Symbol color={mutedColor} name={{ android: "alternate_email", ios: "at" }} size={20} />
            <View className="flex-1 gap-1">
              <Text className="font-semibold">
                <Trans>Send via email</Trans>
              </Text>
              <Text className="text-sm text-muted-foreground">
                <Trans>We’ll email the instructions on your behalf.</Trans>
              </Text>
            </View>
          </View>
          <TextField
            autoComplete="email"
            editable={!sending && !sent}
            inputMode="email"
            label={t`Recipient`}
            onChangeText={(email) => dispatch({ type: "setEmail", email })}
            placeholder={`admin@${domain}`}
            returnKeyType="send"
            textContentType="emailAddress"
            value={state.email}
          />
          <Button disabled={!validEmail || sent} loading={sending} onPress={handleSend}>
            {sent ? (
              <>
                <Symbol
                  color={primaryForeground}
                  name={{ android: "check", ios: "checkmark" }}
                  size={16}
                />
                <Text>
                  <Trans>Sent</Trans>
                </Text>
              </>
            ) : (
              <Text>
                <Trans>Send</Trans>
              </Text>
            )}
          </Button>
        </Card>
      </View>
    </AppBottomSheet>
  );
}
