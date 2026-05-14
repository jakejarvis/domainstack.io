import { Host, Switch as NativeSwitch } from "@expo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Suspense, useRef } from "react";
import { Alert, View } from "react-native";

import { type AppBottomSheetRef } from "@/components/bottom-sheet";
import { GroupedRow, GroupedSection } from "@/components/form/group";
import { CalendarFeedSheet } from "@/components/portfolio/calendar-feed-sheet";
import { Screen } from "@/components/screen";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { BillingSection } from "@/components/settings/billing";
import { DeleteAccountRow } from "@/components/settings/delete-account";
import { LinkedAccountsSection } from "@/components/settings/linked-accounts";
import {
  MutedDomainsSection,
  MutedDomainsSectionSkeleton,
} from "@/components/settings/muted-domains";
import { SkeletonRows } from "@/components/skeleton";
import { MutedText, Text } from "@/components/text";
import { usePushRegistration } from "@/hooks/use-push-registration";
import { useSignOut } from "@/hooks/use-sign-out";
import { analytics } from "@/lib/analytics";
import { useTRPC } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { usePrivacyStore } from "@/lib/stores/privacy-store";

type PreferenceKey =
  | "domainExpiry"
  | "certificateExpiry"
  | "registrationChanges"
  | "providerChanges"
  | "certificateChanges";

type Channel = "inApp" | "email" | "push";

const preferenceLabels: Array<{ key: PreferenceKey; label: string }> = [
  { key: "domainExpiry", label: "Domain expiry" },
  { key: "certificateExpiry", label: "Certificate expiry" },
  { key: "registrationChanges", label: "Registration changes" },
  { key: "providerChanges", label: "Provider changes" },
  { key: "certificateChanges", label: "Certificate changes" },
];

const channels: Array<{ key: Channel; title: string }> = [
  { key: "inApp", title: "In-app" },
  { key: "email", title: "Email" },
  { key: "push", title: "Push" },
];

function NativeToggle({
  disabled,
  onValueChange,
  value,
}: {
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <Host matchContents style={{ minHeight: 32, minWidth: 52 }}>
      <NativeSwitch disabled={disabled} onValueChange={onValueChange} value={value} />
    </Host>
  );
}

export default function SettingsScreen() {
  const calendarSheetRef = useRef<AppBottomSheetRef | null>(null);

  return (
    <Screen>
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
        <CalendarFeedSection onOpen={() => calendarSheetRef.current?.present()} />
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
        <GroupedSection
          footer="Deletes your account, tracked domains, notification preferences, and any active subscription. This action cannot be undone."
          title="Danger zone"
        >
          <DeleteAccountRow />
        </GroupedSection>
      </SectionErrorBoundary>

      <CalendarFeedSheet ref={calendarSheetRef} />
    </Screen>
  );
}

function CalendarFeedSection({ onOpen }: { onOpen: () => void }) {
  return (
    <GroupedSection
      footer="Subscribe to your domain expirations in any calendar app."
      title="Calendar feed"
    >
      <GroupedRow onPress={onOpen} showChevron>
        <Text className="font-semibold">Manage feed</Text>
      </GroupedRow>
    </GroupedSection>
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

  if (preferences.isPending) {
    return (
      <GroupedSection title="Notifications">
        <View className="p-3">
          <SkeletonRows count={3} />
        </View>
      </GroupedSection>
    );
  }

  if (preferences.error || !preferences.data) {
    return (
      <GroupedSection title="Notifications">
        <View className="p-3">
          <MutedText>{preferences.error?.message ?? "Preferences did not load."}</MutedText>
        </View>
      </GroupedSection>
    );
  }

  const prefs = preferences.data;

  return (
    <View className="gap-6">
      {channels.map((channel) => (
        <GroupedSection key={channel.key} title={`${channel.title} notifications`}>
          {preferenceLabels.map((pref) => (
            <GroupedRow
              key={pref.key}
              trailing={
                <NativeToggle
                  onValueChange={(next) =>
                    void updatePreferences.mutateAsync({
                      [pref.key]: { ...prefs[pref.key], [channel.key]: next },
                    })
                  }
                  value={prefs[pref.key][channel.key]}
                />
              }
            >
              <Text className="font-semibold">{pref.label}</Text>
            </GroupedRow>
          ))}
        </GroupedSection>
      ))}
    </View>
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
    <View className="gap-6">
      <GroupedSection
        footer={
          pushRegistration.error
            ? pushRegistration.error.message
            : "Receive push notifications on this device."
        }
        title="This device"
      >
        <GroupedRow
          disabled={pushRegistration.registering}
          onPress={() => void pushRegistration.register()}
        >
          <Text className="font-semibold">
            {pushRegistration.registering ? "Registering…" : "Register this device"}
          </Text>
        </GroupedRow>
      </GroupedSection>

      {devices.data?.map((device) => (
        <GroupedSection
          footer={device.lastError ?? undefined}
          key={device.id}
          title={device.deviceName ?? device.platform}
        >
          <GroupedRow
            trailing={
              <NativeToggle
                onValueChange={(enabled) =>
                  void setDeviceEnabled.mutateAsync({
                    enabled,
                    expoPushToken: device.expoPushToken,
                  })
                }
                value={device.enabled}
              />
            }
          >
            <Text className="font-semibold">Enabled</Text>
          </GroupedRow>
          <GroupedRow
            disabled={unregisterDevice.isPending}
            onPress={() =>
              Alert.alert("Unregister device?", "Push notifications will stop on this device.", [
                { style: "cancel", text: "Cancel" },
                {
                  onPress: () =>
                    void unregisterDevice.mutateAsync({ expoPushToken: device.expoPushToken }),
                  style: "destructive",
                  text: "Unregister",
                },
              ])
            }
          >
            <Text className="font-semibold text-danger">Unregister</Text>
          </GroupedRow>
        </GroupedSection>
      ))}
    </View>
  );
}

function PrivacySection() {
  const analyticsEnabled = usePrivacyStore((state) => state.analyticsEnabled);
  const errorCaptureEnabled = usePrivacyStore((state) => state.errorCaptureEnabled);
  const hasHydrated = usePrivacyStore((state) => state.hasHydrated);
  const setAnalyticsEnabled = usePrivacyStore((state) => state.setAnalyticsEnabled);
  const setErrorCaptureEnabled = usePrivacyStore((state) => state.setErrorCaptureEnabled);

  return (
    <GroupedSection title="Privacy">
      <GroupedRow
        trailing={
          <NativeToggle
            disabled={!hasHydrated}
            onValueChange={setAnalyticsEnabled}
            value={analyticsEnabled}
          />
        }
      >
        <Text className="font-semibold">Product analytics</Text>
      </GroupedRow>
      <GroupedRow
        trailing={
          <NativeToggle
            disabled={!hasHydrated}
            onValueChange={setErrorCaptureEnabled}
            value={errorCaptureEnabled}
          />
        }
      >
        <Text className="font-semibold">Error reporting</Text>
      </GroupedRow>
    </GroupedSection>
  );
}

function AccountSection() {
  const session = authClient.useSession();
  const email = session.data?.user?.email;
  const signOut = useSignOut();

  return (
    <View className="gap-6">
      {email ? (
        <GroupedSection
          footer="To change your email, sign in with a different external account or contact support."
          title="Account"
        >
          <GroupedRow>
            <MutedText className="flex-1" numberOfLines={1} selectable>
              {email}
            </MutedText>
          </GroupedRow>
        </GroupedSection>
      ) : null}
      <LinkedAccountsSection />
      <GroupedSection>
        <GroupedRow
          onPress={() => {
            analytics.track("sign_out_clicked");
            void signOut().then(() => router.replace("/(tabs)/search"));
          }}
        >
          <Text className="font-semibold text-danger">Sign out</Text>
        </GroupedRow>
      </GroupedSection>
    </View>
  );
}
