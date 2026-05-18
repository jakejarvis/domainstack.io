import { Host, Switch as NativeSwitch } from "@expo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { Suspense, useCallback, useRef, useState } from "react";
import { Linking, View } from "react-native";

import { type AppBottomSheetRef } from "@/components/bottom-sheet";
import { Button } from "@/components/button";
import { Callout } from "@/components/callout";
import { GroupedRow, GroupedSection } from "@/components/form/group";
import { CalendarFeedSheet } from "@/components/portfolio/calendar-feed-sheet";
import { Screen } from "@/components/screen";
import {
  SectionErrorBoundary,
  type SectionErrorReporter,
  SectionErrorReporterContext,
} from "@/components/section-error-boundary";
import { BillingSection } from "@/components/settings/billing";
import { DeleteAccountRow } from "@/components/settings/delete-account";
import { LinkedAccountsSection } from "@/components/settings/linked-accounts";
import {
  MutedDomainsSection,
  MutedDomainsSectionSkeleton,
} from "@/components/settings/muted-domains";
import { SkeletonRows } from "@/components/skeleton";
import { Text } from "@/components/text";
import { usePushRegistration } from "@/hooks/use-push-registration";
import { useSignOut } from "@/hooks/use-sign-out";
import { analytics } from "@/lib/analytics";
import { useTRPC } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { confirmDestructive } from "@/lib/native-confirm";
import { getPushPermissionStatus, type PushPermissionStatus } from "@/lib/push";
import { usePrivacyStore } from "@/lib/stores/privacy-store";
import { toast } from "@/lib/toast";
import { toastMutationError } from "@/lib/trpc-error-handler";

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

export { ScreenErrorBoundary as ErrorBoundary } from "@/components/screen-error-boundary";

export default function SettingsScreen() {
  const calendarSheetRef = useRef<AppBottomSheetRef | null>(null);
  const [failedSections, setFailedSections] = useState<ReadonlySet<string>>(() => new Set());

  const reportSectionError = useCallback<SectionErrorReporter>((name, hasError) => {
    setFailedSections((prev) => {
      if (hasError === prev.has(name)) return prev; // no-op → no needless render
      const next = new Set(prev);
      if (hasError) next.add(name);
      else next.delete(name);
      return next;
    });
  }, []);

  return (
    <Screen>
      {failedSections.size > 2 ? (
        <Callout variant="warn">
          Several settings sections couldn’t load. Pull down to refresh, or retry them individually
          below.
        </Callout>
      ) : null}
      <SectionErrorReporterContext.Provider value={reportSectionError}>
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
      </SectionErrorReporterContext.Provider>

      <CalendarFeedSheet ref={calendarSheetRef} />
    </Screen>
  );
}

function CalendarFeedSection({ onOpen }: { onOpen: () => void }) {
  return (
    <GroupedSection footer="Add your domain expirations to your phone's calendar." title="Calendar">
      <GroupedRow onPress={onOpen} showChevron>
        <Text className="font-semibold">Manage calendar</Text>
      </GroupedRow>
    </GroupedSection>
  );
}

function NotificationChannelsSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const preferences = useQuery(trpc.user.getNotificationPreferences.queryOptions());
  const prefsKey = trpc.user.getNotificationPreferences.queryKey();
  type Prefs = NonNullable<typeof preferences.data>;

  const updatePreferences = useMutation(
    trpc.user.updateGlobalNotificationPreferences.mutationOptions({
      // Optimistic: rapid toggles must feel instant and not snap back while a
      // whole-query invalidation refetches. Apply the partial locally, roll
      // back on failure, reconcile once the request settles.
      onMutate: async (vars) => {
        await queryClient.cancelQueries({ queryKey: prefsKey });
        const previous = queryClient.getQueryData<Prefs>(prefsKey);
        queryClient.setQueryData<Prefs | undefined>(prefsKey, (old) =>
          old ? { ...old, ...(vars as Partial<Prefs>) } : old,
        );
        return { previous };
      },
      onError: (err, _vars, ctx) => {
        const previous = (ctx as { previous?: Prefs } | undefined)?.previous;
        if (previous) queryClient.setQueryData(prefsKey, previous);
        toastMutationError("Couldn’t update notifications", err);
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: prefsKey }),
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
        <View className="gap-3 p-3">
          <Text className="text-sm text-muted-foreground">
            {preferences.error?.message ?? "Preferences did not load."}
          </Text>
          <Button onPress={() => void preferences.refetch()} variant="secondary">
            <Text>Try again</Text>
          </Button>
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

  const [permission, setPermission] = useState<PushPermissionStatus | null>(null);
  const refreshPermission = useCallback(() => {
    void getPushPermissionStatus().then(setPermission);
  }, []);
  // Re-check on focus so returning from the OS Settings app reflects a freshly
  // granted/denied permission without a manual refresh.
  useFocusEffect(refreshPermission);

  async function handleRegister() {
    const outcome = await pushRegistration.register();
    refreshPermission();
    if (outcome === "granted") {
      toast.success("This device is registered for notifications.");
    } else if (outcome === "error") {
      toast.error({
        title: "Couldn’t register device",
        message: "Something went wrong. Please try again.",
      });
    }
    // "denied"/"undetermined": the recovery notice below now reflects it.
  }

  const devicesKey = trpc.user.getPushDevices.queryKey();
  type Devices = NonNullable<typeof devices.data>;
  const invalidateDevices = () => queryClient.invalidateQueries({ queryKey: devicesKey });

  const setDeviceEnabled = useMutation(
    trpc.user.setPushDeviceEnabled.mutationOptions({
      // Optimistic so the native switch doesn't lag a round-trip; roll back
      // and toast on failure (previously a failed toggle did nothing at all).
      onMutate: async (vars: { enabled: boolean; expoPushToken: string }) => {
        await queryClient.cancelQueries({ queryKey: devicesKey });
        const previous = queryClient.getQueryData<Devices>(devicesKey);
        queryClient.setQueryData<Devices | undefined>(devicesKey, (old) =>
          old?.map((d) =>
            d.expoPushToken === vars.expoPushToken ? { ...d, enabled: vars.enabled } : d,
          ),
        );
        return { previous };
      },
      onError: (err, _vars, ctx) => {
        const previous = (ctx as { previous?: Devices } | undefined)?.previous;
        if (previous) queryClient.setQueryData(devicesKey, previous);
        toastMutationError("Couldn’t update device", err);
      },
      onSettled: invalidateDevices,
    }),
  );
  const unregisterDevice = useMutation(
    trpc.user.unregisterPushDevice.mutationOptions({
      onSuccess: invalidateDevices,
      onError: (err) => toastMutationError("Couldn’t unregister device", err),
    }),
  );

  return (
    <View className="gap-6">
      {permission === "denied" ? (
        <GroupedSection
          footer="Notifications are turned off for Domainstack. Enable them in Settings, then come back."
          title="This device"
        >
          <GroupedRow onPress={() => void Linking.openSettings()}>
            <Text className="font-semibold">Open Settings</Text>
          </GroupedRow>
        </GroupedSection>
      ) : (
        <GroupedSection footer="Receive push notifications on this device." title="This device">
          <GroupedRow disabled={pushRegistration.registering} onPress={() => void handleRegister()}>
            <Text className="font-semibold">
              {pushRegistration.registering ? "Registering…" : "Register this device"}
            </Text>
          </GroupedRow>
        </GroupedSection>
      )}

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
              void confirmDestructive({
                confirmLabel: "Unregister",
                message: "Push notifications will stop on this device.",
                title: "Unregister device?",
              }).then((confirmed) => {
                if (confirmed) {
                  void unregisterDevice.mutateAsync({ expoPushToken: device.expoPushToken });
                }
              })
            }
          >
            <Text className="font-semibold text-destructive">Unregister</Text>
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
            <Text numberOfLines={1} selectable className="flex-1 text-sm text-muted-foreground">
              {email}
            </Text>
          </GroupedRow>
        </GroupedSection>
      ) : null}
      <LinkedAccountsSection />
      <GroupedSection>
        <GroupedRow
          onPress={() => {
            analytics.track("sign_out_clicked");
            void signOut().then((ok) => {
              if (ok) router.replace("/(tabs)/search");
            });
          }}
        >
          <Text className="font-semibold">Sign out</Text>
        </GroupedRow>
      </GroupedSection>
    </View>
  );
}
