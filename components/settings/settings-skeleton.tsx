import { CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Skeleton for the subscription section.
 * Shows placeholders for plan info, usage progress, and upgrade/manage button.
 */
export function SubscriptionSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <CardHeader className="mb-2 px-0 pt-0 pb-2">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="mt-1 h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-4 px-0 pt-1">
        {/* Current plan card */}
        <div className="flex items-center justify-between rounded-xl border border-black/10 bg-muted/30 p-4 dark:border-white/10">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-2 w-24 rounded-full" />
        </div>

        {/* Pro upgrade section */}
        <div className="relative overflow-hidden rounded-xl border border-black/10 bg-gradient-to-br from-black/[0.02] to-black/[0.04] p-4 dark:border-white/10 dark:from-white/[0.02] dark:to-white/[0.04]">
          {/* Decorative elements - matching the actual component */}
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
 * Skeleton for a single global notification row.
 * Matches GlobalNotificationRow: icon + label + info icon + 2 switches (Web/Email).
 */
function GlobalNotificationRowSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 pt-2 pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pt-3 sm:pb-3",
        "border-border/40 border-b last:border-b-0",
        className,
      )}
    >
      {/* Icon + Label */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Skeleton className="size-8 shrink-0 rounded-md sm:size-9" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="size-3.5" />
        </div>
      </div>

      {/* Two switches (Web + Email) */}
      <div className="flex items-center gap-8 pl-12 sm:gap-6 sm:pl-0">
        <div className="flex items-center gap-3 sm:w-16 sm:justify-center">
          <Skeleton className="h-3 w-6 sm:hidden" />
          <Skeleton className="h-5 w-9 rounded-full" />
        </div>
        <div className="flex items-center gap-3 sm:w-16 sm:justify-center">
          <Skeleton className="h-3 w-8 sm:hidden" />
          <Skeleton className="h-5 w-9 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for the calendar feed section.
 * Matches the Calendar Feed header in NotificationsPanel.
 */
function CalendarFeedSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <CardHeader className="px-0 pt-0 pb-2">
        <div className="mb-1 flex items-center gap-2 leading-none">
          <Skeleton className="size-4.5" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="px-0 pt-2">
        {/* Enable button placeholder */}
        <Skeleton className="h-9 w-full rounded-lg" />
      </CardContent>
    </div>
  );
}

/**
 * Skeleton for the notification settings section.
 * Matches NotificationsPanel: Global Preferences (5 rows) + Domain Preferences + Calendar Feed.
 */
export function NotificationsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("max-w-full overflow-x-hidden", className)}>
      {/* Global Preferences section */}
      <CardHeader className="px-0 pt-0 pb-2">
        <div className="mb-1 flex items-center gap-2 leading-none">
          <Skeleton className="size-4.5" />
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-6 w-40 rounded-sm" />
        </div>
      </CardHeader>
      <CardContent className="px-0 pt-1">
        {/* Column headers (hidden on mobile) */}
        <div className="hidden items-center justify-end gap-6 sm:flex">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-3 w-10" />
        </div>

        {/* 5 notification category rows */}
        <div className="space-y-1">
          <GlobalNotificationRowSkeleton />
          <GlobalNotificationRowSkeleton />
          <GlobalNotificationRowSkeleton />
          <GlobalNotificationRowSkeleton />
          <GlobalNotificationRowSkeleton />
        </div>
      </CardContent>

      <Separator className="mt-3 mb-6 bg-muted" />

      {/* Domain Preferences section */}
      <CardHeader className="px-0 pt-0 pb-2">
        <div className="mb-1 flex items-center gap-2 leading-none">
          <Skeleton className="size-4.5" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-4 w-80" />
      </CardHeader>
      <CardContent className="mt-1.5 px-0">
        {/* Info note placeholder (shown when no verified domains) */}
        <div className="flex items-start gap-2 rounded-xl bg-muted/30 px-3 py-2.5">
          <Skeleton className="mt-0.5 size-3.5 shrink-0" />
          <Skeleton className="h-3 w-64" />
        </div>
      </CardContent>

      <Separator className="my-6 bg-muted" />

      {/* Calendar Feed section */}
      <CalendarFeedSkeleton />
    </div>
  );
}

/**
 * Skeleton for a single linked account row.
 * Shows placeholder for provider icon, name, and action button.
 */
function LinkedAccountRowSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border border-black/10 bg-black/[0.02] px-4 py-3 dark:border-white/10 dark:bg-white/[0.02]",
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
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="size-4 bg-destructive/20" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-24 bg-destructive/20" />
          <Skeleton className="h-3 w-40 bg-destructive/10" />
        </div>
      </div>
      <Skeleton className="size-4 bg-destructive/20" />
    </div>
  );
}

/**
 * Skeleton for the Account panel (linked accounts section).
 * Matches AccountPanel: "Login Providers" header + provider rows + danger zone.
 */
export function LinkedAccountsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("max-w-full overflow-x-hidden", className)}>
      <CardHeader className="px-0 pt-0 pb-2">
        <div className="mb-1 flex items-center gap-2 leading-none">
          <Skeleton className="size-4.5" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-4 w-80" />
      </CardHeader>
      <CardContent className="space-y-3 px-0 pt-1">
        <LinkedAccountRowSkeleton />
        <LinkedAccountRowSkeleton />
        <LinkedAccountRowSkeleton />
        <LinkedAccountRowSkeleton />
      </CardContent>

      <Separator className="my-6 bg-muted" />

      <DangerZoneSkeleton />
    </div>
  );
}

/**
 * Skeleton for the tabs navigation.
 * Shows placeholders for tab triggers.
 */
export function SettingsSkeletonTabsList({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex h-auto w-full items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground">
        {/* Subscription Tab (Active) */}
        <div className="flex flex-1 flex-col items-center gap-2 rounded-md bg-background/60 px-4 py-2.5 shadow-sm ring-1 ring-black/5 dark:bg-white/5 dark:shadow-none dark:ring-white/10">
          <Skeleton className="size-[18px] rounded-sm" />
          <Skeleton className="hidden h-3 w-16 sm:block" />
        </div>

        {/* Notifications Tab */}
        <div className="flex flex-1 flex-col items-center gap-2 rounded-md px-4 py-2.5">
          <Skeleton className="size-[18px] rounded-sm" />
          <Skeleton className="hidden h-3 w-16 sm:block" />
        </div>

        {/* Account Tab */}
        <div className="flex flex-1 flex-col items-center gap-2 rounded-md px-4 py-2.5">
          <Skeleton className="size-[18px] rounded-sm" />
          <Skeleton className="hidden h-3 w-12 sm:block" />
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
