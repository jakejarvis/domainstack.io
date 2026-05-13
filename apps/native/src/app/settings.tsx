import { Host, Switch as NativeSwitch } from "@expo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { GlassCard } from "@/components/glass-card";
import { Screen } from "@/components/screen";
import { SkeletonRows } from "@/components/skeleton";
import { MutedText, Text } from "@/components/text";
import { usePushRegistration } from "@/hooks/use-push-registration";
import { useTRPC } from "@/lib/api";
import { signOut } from "@/lib/auth";
import { formatDate } from "@/lib/format";

type PreferenceKey =
  | "domainExpiry"
  | "certificateExpiry"
  | "registrationChanges"
  | "providerChanges"
  | "certificateChanges";

const preferenceLabels: Array<{ key: PreferenceKey; label: string }> = [
  { key: "domainExpiry", label: "Domain expiry" },
  { key: "certificateExpiry", label: "Certificate expiry" },
  { key: "registrationChanges", label: "Registration changes" },
  { key: "providerChanges", label: "Provider changes" },
  { key: "certificateChanges", label: "Certificate changes" },
];

function ToggleRow({
  label,
  onValueChange,
  value,
}: {
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View className="min-h-12 flex-row items-center justify-between gap-4">
      <Text className="flex-1 font-semibold">{label}</Text>
      <Host matchContents style={{ minHeight: 36, minWidth: 52 }}>
        <NativeSwitch onValueChange={onValueChange} value={value} />
      </Host>
    </View>
  );
}

export default function SettingsScreen() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [errorCaptureEnabled, setErrorCaptureEnabled] = useState(true);
  const pushRegistration = usePushRegistration();

  const subscription = useQuery(trpc.user.getSubscription.queryOptions());
  const preferences = useQuery(trpc.user.getNotificationPreferences.queryOptions());
  const devices = useQuery(trpc.user.getPushDevices.queryOptions());
  const linkedAccounts = useQuery(trpc.user.getLinkedAccounts.queryOptions());

  const invalidate = async () => {
    await queryClient.invalidateQueries();
  };

  const updatePreferences = useMutation(
    trpc.user.updateGlobalNotificationPreferences.mutationOptions({ onSuccess: invalidate }),
  );
  const setDeviceEnabled = useMutation(
    trpc.user.setPushDeviceEnabled.mutationOptions({ onSuccess: invalidate }),
  );
  const unregisterDevice = useMutation(
    trpc.user.unregisterPushDevice.mutationOptions({ onSuccess: invalidate }),
  );

  const prefs = preferences.data;

  return (
    <Screen>
      <View className="gap-2">
        <Text className="text-4xl font-semibold">Settings</Text>
        <MutedText>
          Account, alert channels, device registration, plan, and privacy controls.
        </MutedText>
      </View>

      <GlassCard>
        <Text className="text-xl font-semibold">Plan</Text>
        {subscription.isPending ? (
          <SkeletonRows count={1} />
        ) : subscription.data ? (
          <View className="gap-2">
            <Text className="text-lg font-semibold">{subscription.data.plan}</Text>
            <MutedText>
              {subscription.data.activeCount} of {subscription.data.planQuota} active domains used
            </MutedText>
            {subscription.data.endsAt && (
              <MutedText>Access ends {formatDate(subscription.data.endsAt)}</MutedText>
            )}
          </View>
        ) : (
          <MutedText>Plan details are unavailable.</MutedText>
        )}
      </GlassCard>

      <GlassCard>
        <Text className="text-xl font-semibold">Notification channels</Text>
        {preferences.isPending && <SkeletonRows count={2} />}
        {preferences.error && (
          <EmptyState
            actionLabel="Retry"
            body={preferences.error.message}
            onAction={() => void preferences.refetch()}
            title="Preferences did not load"
          />
        )}
        {prefs &&
          preferenceLabels.map((pref) => (
            <View className="gap-2" key={pref.key}>
              <Text className="font-semibold">{pref.label}</Text>
              <ToggleRow
                label="In-app"
                onValueChange={(inApp) =>
                  void updatePreferences.mutateAsync({
                    [pref.key]: { ...prefs[pref.key], inApp },
                  })
                }
                value={prefs[pref.key].inApp}
              />
              <ToggleRow
                label="Email"
                onValueChange={(email) =>
                  void updatePreferences.mutateAsync({
                    [pref.key]: { ...prefs[pref.key], email },
                  })
                }
                value={prefs[pref.key].email}
              />
              <ToggleRow
                label="Push"
                onValueChange={(push) =>
                  void updatePreferences.mutateAsync({
                    [pref.key]: { ...prefs[pref.key], push },
                  })
                }
                value={prefs[pref.key].push}
              />
            </View>
          ))}
      </GlassCard>

      <GlassCard>
        <Text className="text-xl font-semibold">Push device</Text>
        <Button
          loading={pushRegistration.registering}
          onPress={() => void pushRegistration.register()}
          variant="secondary"
        >
          Register this device
        </Button>
        {pushRegistration.error && <MutedText>{pushRegistration.error.message}</MutedText>}
        {devices.data?.map((device) => (
          <View className="border-line bg-canvas-2 gap-2 rounded-xl border p-3" key={device.id}>
            <Text className="font-semibold">{device.deviceName ?? device.platform}</Text>
            <MutedText numberOfLines={1}>{device.expoPushToken}</MutedText>
            {device.lastError && <MutedText>{device.lastError}</MutedText>}
            <ToggleRow
              label="Enabled"
              onValueChange={(enabled) =>
                void setDeviceEnabled.mutateAsync({
                  enabled,
                  expoPushToken: device.expoPushToken,
                })
              }
              value={device.enabled}
            />
            <Button
              loading={unregisterDevice.isPending}
              onPress={() =>
                void unregisterDevice.mutateAsync({ expoPushToken: device.expoPushToken })
              }
              variant="danger"
            >
              Unregister
            </Button>
          </View>
        ))}
      </GlassCard>

      <GlassCard>
        <Text className="text-xl font-semibold">Privacy</Text>
        <ToggleRow
          label="Product analytics"
          onValueChange={setAnalyticsEnabled}
          value={analyticsEnabled}
        />
        <ToggleRow
          label="Error capture"
          onValueChange={setErrorCaptureEnabled}
          value={errorCaptureEnabled}
        />
      </GlassCard>

      <GlassCard>
        <Text className="text-xl font-semibold">Account</Text>
        <MutedText>
          Linked providers:{" "}
          {linkedAccounts.data?.map((account) => account.providerId).join(", ") || "None"}
        </MutedText>
        <Button
          onPress={() => {
            void signOut().then(() => router.replace("/(tabs)/search"));
          }}
          variant="secondary"
        >
          Sign out
        </Button>
      </GlassCard>
    </Screen>
  );
}
