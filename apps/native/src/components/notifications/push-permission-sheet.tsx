import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";

import { AppBottomSheet, type AppBottomSheetRef } from "@/components/bottom-sheet";
import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { usePushRegistration } from "@/hooks/use-push-registration";
import { usePushPromptStore } from "@/lib/stores/push-prompt-store";

export function PushPermissionSheet() {
  const ref = useRef<AppBottomSheetRef>(null);
  const isOpen = usePushPromptStore((state) => state.isOpen);
  const close = usePushPromptStore((state) => state.close);
  const { register, registering, error } = usePushRegistration();
  const brand = useCSSVariable("--color-brand") as string;

  useEffect(() => {
    if (isOpen) ref.current?.present();
    else ref.current?.dismiss();
  }, [isOpen]);

  async function handleEnable() {
    try {
      await register();
    } finally {
      close();
    }
  }

  return (
    <AppBottomSheet
      description="We'll only ping you about things that matter — registrations or certificates about to expire, providers switching, or DNS changes you didn't make."
      onDismiss={close}
      ref={ref}
      snapPoints={["55%"]}
      title="Stay on top of your domains"
    >
      <View className="gap-4">
        <View className="gap-3">
          <PerkRow
            color={brand}
            icon={{ ios: "clock", android: "schedule" }}
            label="Expiry warnings before it's too late to renew"
          />
          <PerkRow
            color={brand}
            icon={{ ios: "checkmark.shield", android: "verified_user" }}
            label="SSL certificate changes and renewals"
          />
          <PerkRow
            color={brand}
            icon={{ ios: "arrow.left.arrow.right", android: "swap_horiz" }}
            label="Registrar, DNS, and hosting provider changes"
          />
        </View>
        <View className="gap-2">
          <Button loading={registering} onPress={() => void handleEnable()}>
            <Text>Enable notifications</Text>
          </Button>
          <Button disabled={registering} onPress={close} variant="secondary">
            <Text>Not now</Text>
          </Button>
          {error ? <Text className="text-sm text-destructive">{error.message}</Text> : null}
        </View>
      </View>
    </AppBottomSheet>
  );
}

function PerkRow({
  color,
  icon,
  label,
}: {
  color: string;
  icon: SymbolViewProps["name"];
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <SymbolView name={icon} size={22} tintColor={color} />
      <Text className="flex-1">{label}</Text>
    </View>
  );
}
