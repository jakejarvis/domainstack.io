import { getEnabledProviders } from "@/lib/oauth";
import { Card, CardContent, CardHeader } from "@domainstack/ui/card";
import { Separator } from "@domainstack/ui/separator";
import { Skeleton } from "@domainstack/ui/skeleton";
import { cn } from "@domainstack/ui/utils";

function SettingsCardHeaderSkeleton({
  titleClassName,
  descriptionClassName,
}: {
  titleClassName: string;
  descriptionClassName: string;
}) {
  return (
    <CardHeader className="gap-1 px-0 pt-0">
      <Skeleton className={cn("h-[15px]", titleClassName)} />
      <Skeleton className={cn("h-5", descriptionClassName)} />
    </CardHeader>
  );
}

/**
 * Skeleton for the subscription section.
 * Shows placeholders for plan info, usage progress, and upgrade/manage button.
 */
export function SubscriptionSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <SettingsCardHeaderSkeleton titleClassName="w-12" descriptionClassName="w-64" />
      <CardContent className="space-y-4 px-0">
        {/* Current plan card — matches PlanStatusCard */}
        <div className="flex items-center justify-between rounded-xl border border-black/10 bg-muted/30 p-4 dark:border-white/10">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-2 w-24 rounded-full" />
        </div>

        {/* Pro upgrade section — default Free-plan loaded UI */}
        <div className="relative overflow-hidden rounded-xl border border-black/10 bg-gradient-to-br from-black/[0.02] to-black/[0.04] p-4 dark:border-white/10 dark:from-white/[0.02] dark:to-white/[0.04]">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-8 -right-8 size-32 rounded-full bg-accent-gold/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-8 -left-8 size-24 rounded-full bg-accent-gold-muted/15 blur-3xl"
          />

          <div className="relative space-y-3">
            <Skeleton className="h-5 w-12" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-36" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Skeleton className="h-4 w-30" />
            </div>
            <Skeleton className="mt-1 h-10 w-full rounded-lg" />
          </div>
        </div>
      </CardContent>
    </div>
  );
}

/**
 * Skeleton for the notification matrix.
 * Matches NotificationMatrix: header row + 5 category rows with checkboxes.
 */
function NotificationMatrixSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      {/* Header row */}
      <div className="flex items-center border-b border-border py-2 pr-2 pl-1">
        <Skeleton className="h-3 w-16" />
        <div className="ml-auto flex items-center gap-1">
          <div className="flex w-14 justify-center">
            <Skeleton className="h-3 w-8" />
          </div>
          <div className="flex w-14 justify-center">
            <Skeleton className="h-3 w-10" />
          </div>
        </div>
      </div>

      {/* Category rows */}
      <div className="divide-y divide-border/30">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center py-2 pr-2 pl-1">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Skeleton className="mr-0.5 size-3.5 shrink-0" />
              <Skeleton className="h-3.5 w-28" />
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
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for the calendar feed section.
 * Matches the Calendar Feed SettingsCard + disabled Enable button.
 */
function CalendarFeedSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <SettingsCardHeaderSkeleton titleClassName="w-28" descriptionClassName="w-72" />
      <CardContent className="px-0">
        <Skeleton className="h-9 w-full rounded-md" />
      </CardContent>
    </div>
  );
}

/**
 * Skeleton for the notification settings section.
 * Matches NotificationsPanel: Global Preferences matrix + Domain Overrides + Calendar Feed.
 */
export function NotificationsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("max-w-full overflow-x-hidden", className)}>
      {/* Global Preferences section */}
      <div className="space-y-4">
        <SettingsCardHeaderSkeleton titleClassName="w-36" descriptionClassName="w-64" />
        <CardContent className="px-0">
          <NotificationMatrixSkeleton />
        </CardContent>
      </div>

      <Separator className="mt-4 mb-6 bg-muted" />

      {/* Muted Domains section */}
      <div className="space-y-4">
        <SettingsCardHeaderSkeleton titleClassName="w-32" descriptionClassName="w-72" />
        <CardContent className="px-0">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
        </CardContent>
      </div>

      <Separator className="my-6 bg-muted" />

      {/* Calendar Feed section */}
      <CalendarFeedSkeleton />
    </div>
  );
}

/**
 * Skeleton for a single linked account row.
 * Matches Item size="default" variant="outline".
 */
function LinkedAccountRowSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-between rounded-lg border border-border px-3 py-2.5",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-4" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-8 w-16 rounded-md" />
    </div>
  );
}

/**
 * Skeleton for the danger zone section.
 * Shows a collapsed danger zone trigger placeholder.
 */
function DangerZoneSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-md border border-destructive/20", className)}>
      <div className="flex items-center justify-between bg-destructive/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-5 bg-destructive/20" />
          <Skeleton className="h-3.5 w-24 bg-destructive/20" />
        </div>
        <Skeleton className="size-4 bg-destructive/20" />
      </div>
    </div>
  );
}

/**
 * Skeleton for the Account panel (linked accounts section).
 * Matches AccountPanel: "Login Providers" header + provider rows + danger zone.
 */
export function LinkedAccountsSkeleton({ className }: { className?: string }) {
  const providers = getEnabledProviders();
  const rowKeys =
    providers.length > 0 ? providers.map((p) => p.id) : ["github", "gitlab", "google", "vercel"];

  return (
    <div className={cn("max-w-full overflow-x-hidden", className)}>
      <div className="space-y-4">
        <SettingsCardHeaderSkeleton titleClassName="w-28" descriptionClassName="w-80" />
        <CardContent className="px-0">
          <div className="flex w-full flex-col gap-2.5">
            {rowKeys.map((key) => (
              <LinkedAccountRowSkeleton key={key} />
            ))}
          </div>
        </CardContent>
      </div>

      <Separator className="my-6 bg-muted" />

      <DangerZoneSkeleton />
    </div>
  );
}

/**
 * Skeleton for the tabs navigation.
 * Shows placeholders for tab triggers (line variant with full-width border).
 */
export function SettingsSkeletonTabsList({ className }: { className?: string }) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex h-10 w-full items-center gap-1.5 border-b border-muted">
        {/* Subscription Tab (active) — indicator is the 2px `bg-foreground` underline */}
        <div className="relative flex h-full items-center gap-2 px-2">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="h-3.5 w-[76px]" />
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground" />
        </div>

        {/* Notifications Tab */}
        <div className="flex h-full items-center gap-2 px-2">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="h-3.5 w-[76px]" />
        </div>

        {/* Account Tab */}
        <div className="flex h-full items-center gap-2 px-2">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="h-3.5 w-[52px]" />
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for settings content panels.
 * Defaults to Subscription (first tab).
 */
export function SettingsSkeletonPanels({ className }: { className?: string }) {
  return (
    <div className={className}>
      <SubscriptionSkeleton />
    </div>
  );
}

/**
 * Full settings page loading shell: title + tabbed card.
 */
export function SettingsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-6 w-80" />
      </div>
      <Card className="overflow-hidden border border-black/10 bg-background/80 p-3 shadow-xl backdrop-blur-xl dark:border-white/10">
        <SettingsSkeletonTabsList />
        <SettingsSkeletonPanels className="mt-2 p-2" />
      </Card>
    </div>
  );
}
