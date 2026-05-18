import { useEffect, useRef, useState } from "react";
import { Linking, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { AppBottomSheet, type AppBottomSheetRef } from "@/components/bottom-sheet";
import { Button } from "@/components/button";
import { Symbol, type SymbolName } from "@/components/symbol";
import { Text } from "@/components/text";
import { usePushRegistration } from "@/hooks/use-push-registration";
import { getPushPermissionStatus, type PushPermissionStatus } from "@/lib/push";
import { usePushPromptStore } from "@/lib/stores/push-prompt-store";
import { toast } from "@/lib/toast";

export function PushPermissionSheet() {
  const ref = useRef<AppBottomSheetRef>(null);
  const isOpen = usePushPromptStore((state) => state.isOpen);
  const close = usePushPromptStore((state) => state.close);
  const { register, registering } = usePushRegistration();
  const brand = useCSSVariable("--color-brand") as string;
  // `null` until the status resolves so we don't flash the "enable" CTA at a
  // user who actually needs the Settings recovery (or vice versa).
  const [permission, setPermission] = useState<PushPermissionStatus | null>(null);

  useEffect(() => {
    if (!isOpen) {
      ref.current?.dismiss();
      return;
    }
    ref.current?.present();
    let active = true;
    void getPushPermissionStatus().then((status) => {
      if (active) setPermission(status);
    });
    return () => {
      active = false;
    };
  }, [isOpen]);

  async function handleEnable() {
    const outcome = await register();
    if (outcome === "granted") {
      close();
      return;
    }
    if (outcome === "denied") {
      // Denied at the OS dialog — don't dead-end on a closed sheet; flip to the
      // recovery state so the next step (Open Settings) is one tap away.
      setPermission("denied");
      return;
    }
    if (outcome === "error") {
      toast.error({
        title: "Couldn’t enable notifications",
        message: "Something went wrong. Please try again.",
      });
      return;
    }
    close();
  }

  function handleOpenSettings() {
    void Linking.openSettings();
    close();
  }

  const isDenied = permission === "denied";

  return (
    <AppBottomSheet
      description={
        isDenied
          ? "Notifications are turned off for Domainstack. Turn them on in Settings to get expiry, certificate, and provider alerts."
          : "We’ll only ping you about things that matter — registrations or certificates about to expire, providers switching, or DNS changes you didn’t make."
      }
      onDismiss={close}
      ref={ref}
      snapPoints={["55%"]}
      title={isDenied ? "Notifications are off" : "Stay on top of your domains"}
    >
      <View className="gap-4">
        {isDenied ? null : (
          <View className="gap-3">
            <PerkRow
              color={brand}
              icon={{ ios: "clock", android: "schedule" }}
              label="Expiry warnings before it’s too late to renew"
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
        )}
        <View className="gap-2">
          {isDenied ? (
            <Button onPress={handleOpenSettings}>
              <Text>Open Settings</Text>
            </Button>
          ) : (
            <Button loading={registering} onPress={() => void handleEnable()}>
              <Text>Enable notifications</Text>
            </Button>
          )}
          <Button disabled={registering} onPress={close} variant="secondary">
            <Text>Not now</Text>
          </Button>
        </View>
      </View>
    </AppBottomSheet>
  );
}

function PerkRow({ color, icon, label }: { color: string; icon: SymbolName; label: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="size-10 items-center justify-center rounded-full bg-accent-blue/15">
        <Symbol color={color} name={icon} size={20} />
      </View>
      <Text className="flex-1">{label}</Text>
    </View>
  );
}
