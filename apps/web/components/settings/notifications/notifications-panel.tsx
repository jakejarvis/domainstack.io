import { Suspense } from "react";

import {
  CalendarInstructions,
  CalendarInstructionsSkeleton,
} from "@/components/calendar-instructions";
import { DomainMuteList } from "@/components/settings/notifications/domain-mute-list";
import { GlobalPreferencesDescription } from "@/components/settings/notifications/global-preferences-description";
import { NotificationMatrix } from "@/components/settings/notifications/notification-matrix";
import { SettingsCard, SettingsCardSeparator } from "@/components/settings/settings-card";
import { SettingsErrorBoundary } from "@/components/settings/settings-error-boundary";
import { NotificationsSkeleton } from "@/components/settings/settings-skeleton";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";

/**
 * `userEmail` comes from the server session rather than `useSession()`, which is
 * unresolved during SSR and would make the server and first client render differ.
 */
export function NotificationsPanel({ userEmail }: { userEmail: string }) {
  const {
    domains,
    globalPrefs,
    isLoading,
    isError,
    isPending,
    updateGlobalPreference,
    muteDomain,
  } = useNotificationPreferences();

  if (isLoading) {
    return <NotificationsSkeleton />;
  }

  if (isError || !domains || !globalPrefs) {
    throw new Error("Failed to load notification settings");
  }

  const verifiedDomains = domains
    .filter((d) => d.verified)
    .sort((a, b) => a.domainName.localeCompare(b.domainName));

  return (
    <>
      <SettingsCard
        title="Global Preferences"
        description={<GlobalPreferencesDescription email={userEmail} />}
      >
        <NotificationMatrix
          preferences={globalPrefs}
          onToggle={updateGlobalPreference}
          disabled={isPending}
        />
      </SettingsCard>

      <SettingsCardSeparator className="mt-4" />

      <SettingsCard
        title="Muted Domains"
        description="Domains you add here won&rsquo;t trigger any notifications."
      >
        <DomainMuteList
          domains={verifiedDomains.map((d) => ({
            id: d.id,
            domainName: d.domainName,
            muted: d.muted,
          }))}
          onMute={muteDomain}
          disabled={isPending}
        />
      </SettingsCard>

      <SettingsCardSeparator />

      <SettingsCard
        title="Calendar Feed"
        description="Subscribe to domain expiration dates in your calendar app."
      >
        <SettingsErrorBoundary sectionName="Calendar Feed">
          <Suspense fallback={<CalendarInstructionsSkeleton />}>
            <CalendarInstructions />
          </Suspense>
        </SettingsErrorBoundary>
      </SettingsCard>
    </>
  );
}
