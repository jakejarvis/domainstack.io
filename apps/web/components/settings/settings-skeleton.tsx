import { getEnabledProviders } from "@/lib/oauth";
import { CardContent, CardHeader } from "@domainstack/ui/card";
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
 * Skeleton for the subscription section, in its Free-plan layout (usage, plan cards, features).
 */
export function SubscriptionSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <SettingsCardHeaderSkeleton titleClassName="w-12" descriptionClassName="w-72" />
      <CardContent className="space-y-6 px-0">
        {/* PlanUsage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-7 w-14" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>

        {/* FreePlanCard + ProPlanCard */}
        <div className="grid gap-3 sm:grid-cols-2">
          {[false, true].map((pro) => (
            <div
              key={String(pro)}
              className={cn(
                "flex flex-col gap-4 rounded-xl border bg-card/60 p-4",
                pro &&
                  "border-accent-gold/25 bg-linear-to-bl from-accent-gold/10 to-transparent to-60%",
              )}
            >
              <div className="flex min-h-5 items-center justify-between gap-2">
                <Skeleton className="h-5 w-12" />
                {pro ? null : <Skeleton className="h-5 w-24" />}
              </div>
              <div className="space-y-1">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-5 w-36" />
              </div>
              <Skeleton className="h-5 w-44" />
              {pro ? <Skeleton className="mt-auto h-9 w-full" /> : null}
            </div>
          ))}
        </div>

        {/* PlanFeatures */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <div className="grid gap-1.5 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-5 w-full max-w-72" />
            ))}
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
      <div className="space-y-4">
        <SettingsCardHeaderSkeleton titleClassName="w-36" descriptionClassName="w-64" />
        <CardContent className="px-0">
          <NotificationMatrixSkeleton />
        </CardContent>
      </div>

      <Separator className="mt-4 mb-6 bg-muted" />

      <div className="space-y-4">
        <SettingsCardHeaderSkeleton titleClassName="w-32" descriptionClassName="w-72" />
        <CardContent className="px-0">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
        </CardContent>
      </div>

      <Separator className="my-6 bg-muted" />

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
function SettingsSkeletonTabsList({ className }: { className?: string }) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex h-10 w-full items-center gap-1.5 border-b border-muted">
        {/* active tab — indicator is the 2px `bg-foreground` underline */}
        <div className="relative flex h-full items-center gap-2 px-2">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="h-3.5 w-[76px]" />
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground" />
        </div>

        <div className="flex h-full items-center gap-2 px-2">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="h-3.5 w-[76px]" />
        </div>

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
      <div className="flex flex-col gap-2 sm:overflow-hidden sm:rounded-xl sm:border sm:bg-background sm:p-3 sm:shadow-sm">
        <SettingsSkeletonTabsList />
        <SettingsSkeletonPanels className="mt-2 sm:p-2" />
      </div>
    </div>
  );
}
