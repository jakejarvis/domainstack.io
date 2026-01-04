"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import copy from "clipboard-copy";
import { formatDistanceToNow } from "date-fns";
import {
  Calendar,
  CalendarOff,
  CalendarPlus,
  CalendarSync,
  ExternalLink,
  Info,
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
  const [_copied, setCopied] = useState(false);
  const [showRotateDialog, setShowRotateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Query key for cache manipulation
  const feedQueryKey = trpc.user.getCalendarFeed.queryKey();

  // Query
  const feedQuery = useQuery(trpc.user.getCalendarFeed.queryOptions());

  // Mutations
  const enableMutation = useMutation({
    ...trpc.user.enableCalendarFeed.mutationOptions(),
    onSuccess: (data) => {
      queryClient.setQueryData(feedQueryKey, {
        enabled: true,
        feedUrl: data.feedUrl,
        createdAt: data.createdAt,
        rotatedAt: null,
        lastAccessedAt: null,
        accessCount: 0,
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

  const _handleCopy = async (url: string) => {
    try {
      await copy(url);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

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
          <CardTitle>Calendar Feed</CardTitle>
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
        <CardTitle className="flex items-center gap-1.5 leading-none">
          <Calendar className="size-4.5" />
          Calendar Feed
        </CardTitle>
        <CardDescription className="[&_a]:font-medium [&_a]:text-primary/85 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-primary [&_svg]:relative [&_svg]:bottom-px [&_svg]:ml-[3px] [&_svg]:inline-block [&_svg]:size-3 [&_svg]:-translate-y-[1px]">
          Subscribe to domain expiration dates in your calendar app (
          <a
            href="https://support.google.com/calendar/answer/37100"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Calendar
            <ExternalLink />
          </a>
          ,{" "}
          <a
            href="https://support.apple.com/guide/calendar/subscribe-to-calendars-icl1022/mac"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple Calendar
            <ExternalLink />
          </a>
          ,{" "}
          <a
            href="https://support.microsoft.com/en-us/office/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web-cff1429c-5af6-41ec-a5b4-74f2c278e98c"
            target="_blank"
            rel="noopener noreferrer"
          >
            Microsoft Outlook
            <ExternalLink />
          </a>
          , etc.).
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 px-0 pt-1">
        {isEnabled ? (
          <>
            {/* Security warning */}
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-400">
              <ShieldAlert className="size-4 shrink-0 translate-y-[3px]" />
              <div className="space-y-0.5 text-[13px]">
                <p className="font-semibold">Treat this URL as a password.</p>
                <p>
                  Anyone with this link can view your verified domains. You can
                  create a new URL at any time by regenerating it below.
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
            <div className="flex items-center gap-1 text-muted-foreground text-xs leading-none">
              <Info className="size-3 shrink-0" />
              {feed.lastAccessedAt ? (
                <span>
                  Last accessed{" "}
                  {formatDistanceToNow(new Date(feed.lastAccessedAt), {
                    addSuffix: true,
                  })}
                </span>
              ) : (
                <span>Not yet accessed</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setShowRotateDialog(true)}
                disabled={isPending}
              >
                {rotateMutation.isPending ? <Spinner /> : <CalendarSync />}
                Regenerate URL
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isPending}
              >
                {deleteMutation.isPending ? (
                  <Spinner />
                ) : (
                  <CalendarOff className="text-destructive" />
                )}
                Turn Off
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
