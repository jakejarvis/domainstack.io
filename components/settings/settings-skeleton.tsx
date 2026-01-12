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
 * Skeleton for a single notification row.
 * Shows placeholder for icon, label, and toggle.
 */
function NotificationRowSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex items-center gap-3 rounded-xl px-3 py-3", className)}
    >
      {/* Icon placeholder */}
      <Skeleton className="size-9 shrink-0 rounded-lg" />

      {/* Label placeholder */}
      <div className="flex flex-1 items-center gap-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="size-3.5 rounded-full" />
      </div>

      {/* Toggle placeholder */}
      <Skeleton className="h-5 w-9 rounded-full" />
    </div>
  );
}

/**
 * Skeleton for the calendar feed section.
 * Shows placeholders for header, description, and enable button.
 */
function CalendarFeedSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <CardHeader className="mb-2 px-0 pt-0 pb-2">
        <div className="flex items-center gap-2">
          <Skeleton className="size-5 rounded" />
          <Skeleton className="h-6 w-28" />
        </div>
        <Skeleton className="mt-1 h-4 w-80" />
      </CardHeader>
      <CardContent className="space-y-4 px-0 pt-1">
        <Skeleton className="h-10 w-44 rounded-lg" />
      </CardContent>
    </div>
  );
}

/**
 * Skeleton for the notification settings section.
 * Shows placeholders for header, 3 notification rows, and collapsible trigger.
 */
export function NotificationsSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <CardHeader className="mb-2 px-0 pt-0 pb-2">
        <Skeleton className="h-6 w-40" />
        <div className="mt-1 flex items-center gap-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
        </div>
      </CardHeader>
      <CardContent className="space-y-5 px-0 pt-1 pb-0">
        <div className="space-y-1">
          <NotificationRowSkeleton />
          <NotificationRowSkeleton />
          <NotificationRowSkeleton />
        </div>
        <Separator className="my-6 bg-muted" />
        <div className="flex w-full items-center justify-between rounded-lg px-3 py-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="size-4 rounded-sm" />
        </div>
        <Separator className="my-6 bg-muted" />
        <CalendarFeedSkeleton />
      </CardContent>
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
 * Skeleton for the linked accounts section.
 * Shows placeholders for header and 4 provider rows.
 */
export function LinkedAccountsSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <CardHeader className="mb-2 px-0 pt-0 pb-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-1 h-4 w-72" />
      </CardHeader>
      <CardContent className="space-y-3 px-0 pt-1 pb-0">
        <LinkedAccountRowSkeleton />
        <LinkedAccountRowSkeleton />
        <LinkedAccountRowSkeleton />
        <LinkedAccountRowSkeleton />
        <Separator className="my-6 bg-muted" />
        <DangerZoneSkeleton />
      </CardContent>
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
