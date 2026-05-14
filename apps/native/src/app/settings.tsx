import { Host, Switch as NativeSwitch } from "@expo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Suspense, useRef, useState } from "react";
import { Pressable, View } from "react-native";

import { type AppBottomSheetRef } from "@/components/bottom-sheet";
import { Button } from "@/components/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { GlassCard } from "@/components/glass-card";
import { CalendarFeedSheet } from "@/components/portfolio/calendar-feed-sheet";
import { Screen } from "@/components/screen";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { BillingSection } from "@/components/settings/billing";
import { DeleteAccountSection } from "@/components/settings/delete-account";
import { LinkedAccountsSection } from "@/components/settings/linked-accounts";
import {
  MutedDomainsSection,
  MutedDomainsSectionSkeleton,
} from "@/components/settings/muted-domains";
import { SkeletonRows } from "@/components/skeleton";
import { MutedText, Text } from "@/components/text";
import { usePushRegistration } from "@/hooks/use-push-registration";
import { analytics } from "@/lib/analytics";
import { useTRPC } from "@/lib/api";
import { authClient, signOut } from "@/lib/auth";
import { usePrivacyStore } from "@/lib/stores/privacy-store";

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
  disabled,
  label,
  onValueChange,
  value,
}: {
  disabled?: boolean;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View className="min-h-12 flex-row items-center justify-between gap-4">
      <Text className="flex-1 font-semibold">{label}</Text>
      <Host matchContents style={{ minHeight: 36, minWidth: 52 }}>
        <NativeSwitch disabled={disabled} onValueChange={onValueChange} value={value} />
      </Host>
    </View>
  );
}

export default function SettingsScreen() {
  const calendarSheetRef = useRef<AppBottomSheetRef | null>(null);

  return (
    <Screen>
      <View className="gap-2">
        <Text className="text-4xl font-semibold">Settings</Text>
        <MutedText>
          Account, notification channels, device registration, plan, and privacy controls.
        </MutedText>
      </View>

      <SectionErrorBoundary sectionName="Plan">
        <BillingSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Notification channels">
        <NotificationChannelsSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Push device">
        <PushDeviceSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Calendar feed">
        <CalendarFeedRow onOpen={() => calendarSheetRef.current?.present()} />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Muted domains">
        <Suspense fallback={<MutedDomainsSectionSkeleton />}>
          <MutedDomainsSection />
        </Suspense>
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Privacy">
        <PrivacySection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Account">
        <AccountSection />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Danger zone">
        <DeleteAccountSection />
      </SectionErrorBoundary>

      <CalendarFeedSheet ref={calendarSheetRef} />
    </Screen>
  );
}

function CalendarFeedRow({ onOpen }: { onOpen: () => void }) {
  return (
    <GlassCard>
      <View className="gap-1">
        <Text className="text-xl font-semibold">Calendar feed</Text>
        <MutedText>Subscribe to your domain expirations in any calendar app.</MutedText>
      </View>
      <Button onPress={onOpen} variant="secondary">
        <Text>Manage feed</Text>
      </Button>
    </GlassCard>
  );
}

function NotificationChannelsSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const preferences = useQuery(trpc.user.getNotificationPreferences.queryOptions());
  const updatePreferences = useMutation(
    trpc.user.updateGlobalNotificationPreferences.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.user.getNotificationPreferences.queryKey(),
        }),
    }),
  );

  const prefs = preferences.data;

  return (
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
  );
}

function PushDeviceSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const pushRegistration = usePushRegistration();
  const devices = useQuery(trpc.user.getPushDevices.queryOptions());

  const invalidateDevices = () =>
    queryClient.invalidateQueries({ queryKey: trpc.user.getPushDevices.queryKey() });

  const setDeviceEnabled = useMutation(
    trpc.user.setPushDeviceEnabled.mutationOptions({ onSuccess: invalidateDevices }),
  );
  const unregisterDevice = useMutation(
    trpc.user.unregisterPushDevice.mutationOptions({ onSuccess: invalidateDevices }),
  );

  return (
    <GlassCard>
      <Text className="text-xl font-semibold">Push device</Text>
      <Button
        loading={pushRegistration.registering}
        onPress={() => void pushRegistration.register()}
        variant="secondary"
      >
        <Text>Register this device</Text>
      </Button>
      {pushRegistration.error ? <MutedText>{pushRegistration.error.message}</MutedText> : null}
      {devices.data?.map((device) => (
        <View className="border-line bg-canvas-2 gap-2 rounded-xl border p-3" key={device.id}>
          <Text className="font-semibold">{device.deviceName ?? device.platform}</Text>
          <MutedText numberOfLines={1}>{device.expoPushToken}</MutedText>
          {device.lastError ? <MutedText>{device.lastError}</MutedText> : null}
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
            <Text>Unregister</Text>
          </Button>
        </View>
      ))}
    </GlassCard>
  );
}

function PrivacySection() {
  const analyticsEnabled = usePrivacyStore((state) => state.analyticsEnabled);
  const errorCaptureEnabled = usePrivacyStore((state) => state.errorCaptureEnabled);
  const hasHydrated = usePrivacyStore((state) => state.hasHydrated);
  const setAnalyticsEnabled = usePrivacyStore((state) => state.setAnalyticsEnabled);
  const setErrorCaptureEnabled = usePrivacyStore((state) => state.setErrorCaptureEnabled);

  return (
    <GlassCard>
      <Text className="text-xl font-semibold">Privacy</Text>
      <ToggleRow
        disabled={!hasHydrated}
        label="Product analytics"
        onValueChange={setAnalyticsEnabled}
        value={analyticsEnabled}
      />
      <ToggleRow
        disabled={!hasHydrated}
        label="Error reporting"
        onValueChange={setErrorCaptureEnabled}
        value={errorCaptureEnabled}
      />
    </GlassCard>
  );
}

function AccountSection() {
  const session = authClient.useSession();
  const [emailHelpOpen, setEmailHelpOpen] = useState(false);
  const email = session.data?.user?.email;

  return (
    <GlassCard>
      <Text className="text-xl font-semibold">Account</Text>
      {email ? (
        <View className="flex-row flex-wrap items-center gap-2">
          <MutedText className="flex-1" numberOfLines={1} selectable>
            {email}
          </MutedText>
          <Pressable
            accessibilityLabel="Why can't I change my email?"
            accessibilityRole="button"
            className="border-line bg-canvas-2 min-h-8 min-w-8 items-center justify-center rounded-full border px-2"
            onPress={() => setEmailHelpOpen(true)}
          >
            <Text className="text-xs font-semibold">?</Text>
          </Pressable>
        </View>
      ) : null}
      <LinkedAccountsSection />
      <Button
        onPress={() => {
          analytics.track("sign_out_clicked");
          void signOut().then(() => router.replace("/(tabs)/search"));
        }}
        variant="secondary"
      >
        <Text>Sign out</Text>
      </Button>
      <ConfirmDialog
        confirmLabel="Got it"
        description="This is the email address that was verified with the linked account provider you chose at sign up. To change it, sign in with a different external account or contact support."
        onOpenChange={setEmailHelpOpen}
        open={emailHelpOpen}
        title="Why can't I change my email?"
        variant="info"
      />
    </GlassCard>
  );
}
