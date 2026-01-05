import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  CalendarFold,
  CalendarOff,
  CalendarPlus,
  Clock,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarFeedSkeleton } from "@/components/settings/settings-skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyableField } from "@/components/ui/copyable-field";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc/client";

interface CalendarFeedSectionProps {
  className?: string;
}

export function CalendarFeedSection({ className }: CalendarFeedSectionProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showRotateDialog, setShowRotateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Query key for cache manipulation
  const feedQueryKey = trpc.user.getCalendarFeed.queryKey();

  // Query - auto-refresh every 30s to keep "last accessed" timestamp current
  const feedQuery = useQuery({
    ...trpc.user.getCalendarFeed.queryOptions(),
    refetchInterval: 30_000,
  });

  // Mutations
  const enableMutation = useMutation({
    ...trpc.user.enableCalendarFeed.mutationOptions(),
    onSuccess: (data) => {
      queryClient.setQueryData(feedQueryKey, {
        enabled: true,
        feedUrl: data.feedUrl,
        lastAccessedAt: null,
      });
      toast.success("Calendar feed enabled");
    },
    onError: () => {
      toast.error("Failed to enable calendar feed");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: feedQueryKey });
    },
  });

  const disableMutation = useMutation({
    ...trpc.user.disableCalendarFeed.mutationOptions(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: feedQueryKey });
      const previous = queryClient.getQueryData(feedQueryKey);
      queryClient.setQueryData(feedQueryKey, { enabled: false });
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(feedQueryKey, context.previous);
      }
      toast.error("Failed to disable calendar feed");
    },
    onSuccess: () => {
      toast.success("Calendar feed disabled");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: feedQueryKey });
    },
  });

  const rotateMutation = useMutation({
    ...trpc.user.rotateCalendarFeedToken.mutationOptions(),
    onSuccess: () => {
      toast.success("Calendar feed URL regenerated");
      setShowRotateDialog(false);
    },
    onError: () => {
      toast.error("Failed to regenerate URL");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: feedQueryKey });
    },
  });

  const deleteMutation = useMutation({
    ...trpc.user.deleteCalendarFeed.mutationOptions(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: feedQueryKey });
      const previous = queryClient.getQueryData(feedQueryKey);
      queryClient.setQueryData(feedQueryKey, { enabled: false });
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(feedQueryKey, context.previous);
      }
      toast.error("Failed to disable calendar feed");
    },
    onSuccess: () => {
      toast.success("Calendar feed disabled");
      setShowDeleteDialog(false);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: feedQueryKey });
    },
  });

  const isPending =
    enableMutation.isPending ||
    disableMutation.isPending ||
    rotateMutation.isPending ||
    deleteMutation.isPending;

  if (feedQuery.isLoading) {
    return <CalendarFeedSkeleton className={className} />;
  }

  if (feedQuery.isError) {
    return (
      <div className={className}>
        <CardHeader className="px-0 pt-0 pb-2">
          <CardTitle className="mb-1 flex items-center gap-2 leading-none">
            <CalendarFold className="size-4.5" />
            Calendar Feed
          </CardTitle>
          <CardDescription className="text-destructive">
            Failed to load calendar feed settings
          </CardDescription>
        </CardHeader>
      </div>
    );
  }

  const feed = feedQuery.data;
  const isEnabled = feed?.enabled && "feedUrl" in feed;

  return (
    <div className={className}>
      <CardHeader className="px-0 pt-0 pb-2">
        <CardTitle className="mb-1 flex items-center gap-2 leading-none">
          <CalendarFold className="size-4.5" />
          Calendar Feed
        </CardTitle>
        <CardDescription className="[&_a]:font-medium [&_a]:text-primary/85 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-primary">
          Subscribe to domain expiration dates in your calendar app (
          <a
            href={
              // https://jamesdoc.com/blog/2024/webcal/
              isEnabled
                ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feed.feedUrl.replace("https://", "webcal://"))}`
                : "https://support.google.com/calendar/answer/37100"
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Calendar
          </a>
          ,{" "}
          <a
            href={
              isEnabled
                ? feed.feedUrl.replace("https://", "webcal://")
                : "https://support.apple.com/guide/calendar/subscribe-to-calendars-icl1022/mac"
            }
            target={isEnabled ? undefined : "_blank"}
            rel={isEnabled ? undefined : "noopener noreferrer"}
            data-disable-progress={isEnabled ? true : undefined}
          >
            Apple Calendar
          </a>
          ,{" "}
          <a
            href={
              isEnabled
                ? `https://outlook.office.com/calendar/0/addfromweb?url=${encodeURIComponent(feed.feedUrl.replace("https://", "webcal://"))}`
                : "https://support.microsoft.com/en-us/office/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web-cff1429c-5af6-41ec-a5b4-74f2c278e98c"
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            Microsoft Outlook
          </a>
          ,{" "}
          <a
            href="https://flexibits.com/fantastical-ios/help/getting-started#adding-a-calendar-subscription"
            target="_blank"
            rel="noopener noreferrer"
          >
            Fantastical
          </a>
          , and{" "}
          <a
            href="https://chatgpt.com/?prompt=How+do+I+subscribe+to+a+.ics+calendar+feed+in+%5Bmy+calendar+app%5D%3F"
            target="_blank"
            rel="noopener noreferrer"
          >
            more
          </a>
          ).
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 px-0 pt-2">
        {isEnabled ? (
          <>
            {/* Security warning */}
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-400">
              <ShieldAlert className="size-4 shrink-0 translate-y-[3px]" />
              <div className="space-y-0.5 text-[13px]">
                <p className="font-semibold">Treat this URL as a password!</p>
                <p>
                  Anyone with this link can view your verified domains. You can
                  invalidate it at any time by generating a fresh URL below.
                </p>
              </div>
            </div>

            {/* Feed URL */}
            <div>
              <CopyableField
                label="Feed URL"
                value={feed.feedUrl}
                showLabel={false}
              />
            </div>

            {/* Stats */}
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs leading-none">
              <Clock className="size-3 shrink-0" />
              {feed.lastAccessedAt ? (
                <span>
                  Last accessed{" "}
                  {formatDistanceToNow(new Date(feed.lastAccessedAt), {
                    addSuffix: true,
                  })}
                  .
                </span>
              ) : (
                <span>Not accessed yet.</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                variant="outline"
                onClick={() => setShowRotateDialog(true)}
                disabled={isPending}
              >
                {rotateMutation.isPending ? <Spinner /> : <RefreshCw />}
                Regenerate URL
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isPending}
              >
                {deleteMutation.isPending ? <Spinner /> : <CalendarOff />}
                Disable
              </Button>
            </div>
          </>
        ) : (
          /* Enable button */
          <Button
            onClick={() => enableMutation.mutate()}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {enableMutation.isPending ? (
              <>
                <Spinner />
                Enabling...
              </>
            ) : (
              <>
                <CalendarPlus />
                Enable Calendar
              </>
            )}
          </Button>
        )}
      </CardContent>

      {/* Rotate confirmation dialog */}
      <AlertDialog open={showRotateDialog} onOpenChange={setShowRotateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Calendar URL?</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate a new calendar URL. Any calendar subscriptions
              using the old URL will stop receiving updates. You&apos;ll need to
              re-subscribe with the new URL.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rotateMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rotateMutation.mutate()}
              disabled={rotateMutation.isPending}
            >
              {rotateMutation.isPending ? (
                <>
                  <Spinner />
                  Regenerating...
                </>
              ) : (
                "Regenerate"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Calendar Feed?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disable your calendar feed. Any calendar subscriptions
              using this URL will stop working. You can enable a new feed later,
              but it will have a different URL.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              variant="destructive"
            >
              {deleteMutation.isPending ? (
                <>
                  <Spinner />
                  Disabling...
                </>
              ) : (
                "Disable"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
