import { useSession } from "@domainstack/auth/client";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";
import { Suspense } from "react";
import {
  CalendarInstructions,
  CalendarInstructionsSkeleton,
} from "@/components/calendar-instructions";
import { DomainMuteList } from "@/components/settings/notifications/domain-mute-list";
import { NotificationMatrix } from "@/components/settings/notifications/notification-matrix";
import {
  SettingsCard,
  SettingsCardSeparator,
} from "@/components/settings/settings-card";
import { SettingsErrorBoundary } from "@/components/settings/settings-error-boundary";
import { NotificationsSkeleton } from "@/components/settings/settings-skeleton";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";

export function NotificationsPanel() {
  const { data: session } = useSession();
  const {
    domains,
    globalPrefs,
    isLoading,
    isError,
    isPending,
    updateGlobalPreference,
    setDomainMuted,
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
        description={
          <>
            Alerts will be sent to{" "}
            <span className="font-semibold">{session?.user?.email}</span>.{" "}
            <ResponsiveTooltip>
              <ResponsiveTooltipTrigger
                render={
                  <span className="cursor-help text-muted-foreground underline decoration-dotted underline-offset-3" />
                }
              >
                (Why can&rsquo;t I change this?)
              </ResponsiveTooltipTrigger>
              <ResponsiveTooltipContent>
                <div className="space-y-2">
                  <p>
                    This is the email address that was verified with the linked
                    account provider you chose at sign up.
                  </p>
                  <p>
                    To change it, sign in with a different external account or{" "}
                    <a
                      href="/help#contact"
                      className="underline underline-offset-3"
                      target="_blank"
                      rel="noopener"
                    >
                      contact support
                    </a>
                    .
                  </p>
                </div>
              </ResponsiveTooltipContent>
            </ResponsiveTooltip>
          </>
        }
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
          onToggleMuted={setDomainMuted}
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
