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
 * Skeleton for the notification matrix.
 * Matches NotificationMatrix: header row + 5 category rows with checkboxes.
 */
function NotificationMatrixSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-muted/20",
        className,
      )}
    >
      {/* Header row */}
      <div className="flex items-center border-border/50 border-b px-4 py-2.5">
        <Skeleton className="h-3 w-20" />
        <div className="ml-auto flex items-center gap-1">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-14" />
        </div>
      </div>

      {/* Category rows */}
      <div className="divide-y divide-border/30">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Skeleton className="size-4 shrink-0" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex items-center gap-1">
              <div className="flex w-14 items-center justify-center">
                <Skeleton className="size-4 rounded" />
              </div>
              <div className="flex w-14 items-center justify-center">
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
 * Matches NotificationsPanel: Global Preferences matrix + Domain Overrides + Calendar Feed.
 */
export function NotificationsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("max-w-full overflow-x-hidden", className)}>
      {/* Global Preferences section */}
      <CardHeader className="gap-1 px-0 pt-0">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="px-0">
        <NotificationMatrixSkeleton />
      </CardContent>

      <Separator className="my-6 bg-muted" />

      {/* Domain Overrides section */}
      <CardHeader className="gap-1 px-0 pt-0">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-80" />
      </CardHeader>
      <CardContent className="px-0">
        {/* Empty state placeholder */}
        <div className="flex items-center gap-3 rounded-xl border border-border/50 border-dashed bg-muted/10 px-4 py-6">
          <Skeleton className="size-5" />
          <Skeleton className="h-4 w-72" />
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
 * Shows placeholders for tab triggers (line variant with full-width border).
 */
export function SettingsSkeletonTabsList({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex h-10 w-full items-center border-muted border-b">
        {/* Subscription Tab (Active) */}
        <div className="flex h-10 items-center gap-2 border-foreground border-b px-3">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="h-3.5 w-[76px]" />
        </div>

        {/* Notifications Tab */}
        <div className="flex h-10 items-center gap-2 px-3">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="h-3.5 w-[76px]" />
        </div>

        {/* Account Tab */}
        <div className="flex h-10 items-center gap-2 px-3">
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
