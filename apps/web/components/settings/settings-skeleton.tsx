import { DangerZone } from "@/components/settings/account/danger-zone";
import { GlobalPreferencesDescription } from "@/components/settings/notifications/global-preferences-description";
import { SettingsCard, SettingsCardSeparator } from "@/components/settings/settings-card";
import { NOTIFICATION_CATEGORY_INFO } from "@/lib/constants/notification-ui";
import { getEnabledProviders } from "@/lib/oauth";
import { NOTIFICATION_CATEGORIES } from "@domainstack/constants";
import { Skeleton } from "@domainstack/ui/skeleton";
import { TabsContent } from "@domainstack/ui/tabs";
import { cn } from "@domainstack/ui/utils";

// Skeletons render the panels' static copy (card titles, descriptions, labels)
// for real and only placeholder what depends on the user's data.

/**
 * Skeleton for the subscription section, in its Free-plan layout (usage, Pro upsell).
 * The description depends on the plan, so it stays a placeholder.
 */
export function SubscriptionSkeleton({ className }: { className?: string }) {
  return (
    <SettingsCard
      title="Plan"
      description={<Skeleton className="h-5 w-72" />}
      className={className}
    >
      <div className="space-y-6">
        {/* PlanUsage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-7 w-14" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>

        {/* ProUpsell */}
        <div className="@container rounded-xl border border-accent-gold/25 bg-linear-to-bl from-accent-gold/5 to-transparent to-60% p-4">
          <div className="flex flex-col gap-4 @sm:flex-row @sm:items-center @sm:justify-between">
            <div className="space-y-1">
              <Skeleton className="h-5 w-8" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="flex items-center justify-between gap-5 @sm:justify-end">
              <div className="flex flex-col gap-1 @sm:items-end">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-8 w-36 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}

/**
 * Skeleton for the notification matrix: the real header and category labels,
 * with placeholder checkboxes.
 */
function NotificationMatrixSkeleton() {
  return (
    <div>
      <div className="flex items-center border-b border-border py-2 pr-2 pl-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <div className="flex-1">Alert Type</div>
        <div className="flex items-center gap-1">
          <div className="w-14 text-center">Web</div>
          <div className="w-14 text-center">Email</div>
        </div>
      </div>

      <div className="divide-y divide-border/30">
        {NOTIFICATION_CATEGORIES.map((category) => {
          const info = NOTIFICATION_CATEGORY_INFO[category];
          const Icon = info.icon;

          return (
            <div key={category} className="flex items-center py-2 pr-2 pl-1">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Icon className="mr-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
                <span className="truncate text-[13px] font-medium text-muted-foreground">
                  {info.label}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="flex w-14 items-center justify-center py-1">
                  <Skeleton className="size-4 rounded" />
                </div>
                <div className="flex w-14 items-center justify-center py-1">
                  <Skeleton className="size-4 rounded" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Skeleton for the notification settings section.
 * Matches NotificationsPanel: Global Preferences matrix + Muted Domains + Calendar Feed.
 */
export function NotificationsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("max-w-full overflow-x-hidden", className)}>
      <SettingsCard
        title="Global Preferences"
        description={
          <GlobalPreferencesDescription
            email={<Skeleton render={<span />} className="inline-block h-3.5 w-40 align-middle" />}
          />
        }
      >
        <NotificationMatrixSkeleton />
      </SettingsCard>

      <SettingsCardSeparator className="mt-4" />

      <SettingsCard
        title="Muted Domains"
        description="Domains you add here won&rsquo;t trigger any notifications."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
      </SettingsCard>

      <SettingsCardSeparator />

      <SettingsCard
        title="Calendar Feed"
        description="Subscribe to domain expiration dates in your calendar app."
      >
        <Skeleton className="h-9 w-full rounded-md" />
      </SettingsCard>
    </div>
  );
}

/**
 * Skeleton for the Account panel. Provider rows stay placeholders because the
 * real list sorts linked providers first; the Danger Zone renders for real.
 */
export function LinkedAccountsSkeleton({ className }: { className?: string }) {
  const providers = getEnabledProviders();
  const rowKeys =
    providers.length > 0 ? providers.map((p) => p.id) : ["github", "gitlab", "google", "vercel"];

  return (
    <div className={cn("max-w-full overflow-x-hidden", className)}>
      <SettingsCard
        title="Login Providers"
        description="Protect your account with additional third-party services."
      >
        <div className="flex w-full flex-col gap-2.5">
          {rowKeys.map((key) => (
            <div
              key={key}
              className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <Skeleton className="size-4" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCardSeparator />

      <DangerZone />
    </div>
  );
}

/**
 * Skeleton panels for every settings tab, as `TabsContent` so they slot into
 * `SettingsTabsRouter` in place of the real panels while data loads.
 */
export function SettingsSkeletonPanels() {
  return (
    <>
      <TabsContent value="subscription">
        <SubscriptionSkeleton />
      </TabsContent>
      <TabsContent value="notifications">
        <NotificationsSkeleton />
      </TabsContent>
      <TabsContent value="account">
        <LinkedAccountsSkeleton />
      </TabsContent>
    </>
  );
}
