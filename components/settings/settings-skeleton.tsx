import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SettingsSkeletonProps {
  /** Whether to show the card wrapper with visual styling */
  showCard?: boolean;
}

/**
 * Skeleton for the subscription section.
 * Shows placeholders for plan info, usage progress, and upgrade/manage button.
 */
export function SubscriptionSkeleton({ showCard }: { showCard?: boolean }) {
  return (
    <div>
      <CardHeader className={showCard ? "pb-2" : "px-0 pt-0 pb-2"}>
        <Skeleton className="h-6 w-28" />
        <Skeleton className="mt-1 h-4 w-64" />
      </CardHeader>
      <CardContent className={showCard ? "space-y-4" : "space-y-4 px-0 pt-1"}>
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
function NotificationRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-3">
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
 * Skeleton for the notification settings section.
 * Shows placeholders for header and 3 notification rows.
 */
export function NotificationsSkeleton({ showCard }: { showCard?: boolean }) {
  return (
    <div>
      <CardHeader className={showCard ? "pb-2" : "px-0 pt-0 pb-2"}>
        <Skeleton className="h-6 w-40" />
        <div className="mt-1 flex items-center gap-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
        </div>
      </CardHeader>
      <CardContent
        className={showCard ? "space-y-1" : "space-y-1 px-0 pt-1 pb-0"}
      >
        <NotificationRowSkeleton />
        <NotificationRowSkeleton />
        <NotificationRowSkeleton />

        {/* Info note placeholder */}
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted/30 px-3 py-2.5">
          <Skeleton className="mt-0.5 size-3.5 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-72" />
        </div>
      </CardContent>
    </div>
  );
}

/**
 * Skeleton for a single linked account row.
 * Shows placeholder for provider icon, name, and action button.
 */
function LinkedAccountRowSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-xl border border-black/10 bg-black/[0.02] px-4 py-3 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-4" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-8 w-16 rounded-md" />
    </div>
  );
}

/**
 * Skeleton for the linked accounts section.
 * Shows placeholders for header and 4 provider rows.
 */
export function LinkedAccountsSkeleton({ showCard }: { showCard?: boolean }) {
  return (
    <div>
      <CardHeader className={showCard ? "pb-2" : "px-0 pt-0 pb-2"}>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-1 h-4 w-72" />
      </CardHeader>
      <CardContent
        className={showCard ? "space-y-3" : "space-y-3 px-0 pt-1 pb-0"}
      >
        <LinkedAccountRowSkeleton />
        <LinkedAccountRowSkeleton />
        <LinkedAccountRowSkeleton />
        <LinkedAccountRowSkeleton />
      </CardContent>
    </div>
  );
}

/**
 * Skeleton for the danger zone section.
 * Shows a collapsed danger zone trigger placeholder.
 */
export function DangerZoneSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
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
 * Loading skeleton for settings content.
 * Shows placeholders for all settings sections.
 */
export function SettingsSkeleton({ showCard = true }: SettingsSkeletonProps) {
  const content = (
    <div className={cn("space-y-6", !showCard && "py-1")}>
      {/* Subscription skeleton */}
      <SubscriptionSkeleton showCard={showCard} />

      {/* Divider */}
      <div className={cn("h-px bg-border/50", showCard ? "mx-6" : "")} />

      {/* Notifications skeleton */}
      <NotificationsSkeleton showCard={showCard} />

      {/* Divider */}
      <div className={cn("h-px bg-border/50", showCard ? "mx-6" : "")} />

      {/* Linked accounts skeleton */}
      <LinkedAccountsSkeleton showCard={showCard} />

      {/* Divider */}
      <div className={cn("h-px bg-border/50", showCard ? "mx-6" : "")} />

      {/* Danger zone skeleton */}
      <div className={showCard ? "px-6 pb-6" : ""}>
        <DangerZoneSkeleton />
      </div>
    </div>
  );

  if (!showCard) {
    return content;
  }

  return <Card className="overflow-hidden">{content}</Card>;
}
