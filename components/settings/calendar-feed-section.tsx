"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import copy from "clipboard-copy";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Calendar,
  Check,
  Copy,
  RefreshCw,
  Trash2,
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
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc/client";

interface CalendarFeedSectionProps {
  className?: string;
}

export function CalendarFeedSection({ className }: CalendarFeedSectionProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
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
      toast.error("Failed to delete calendar feed");
    },
    onSuccess: () => {
      toast.success("Calendar feed deleted");
      setShowDeleteDialog(false);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: feedQueryKey });
    },
  });

  const handleCopy = async (url: string) => {
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
        <CardTitle className="flex items-center gap-2">
          <Calendar className="size-5" />
          Calendar Feed
        </CardTitle>
        <CardDescription>
          Subscribe to domain expiration dates in your calendar app (Google
          Calendar, Apple Calendar, Outlook, etc.)
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 px-0 pt-1">
        {isEnabled ? (
          <>
            {/* Feed URL */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={feed.feedUrl}
                  className="font-mono text-xs"
                  onClick={(e) => e.currentTarget.select()}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(feed.feedUrl)}
                  disabled={isPending}
                  aria-label="Copy feed URL"
                >
                  {copied ? (
                    <Check className="size-4 text-success" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>

              {/* Security warning */}
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p className="text-xs">
                  Treat this URL as a secret. Anyone with this link can view
                  your domain expiration dates.
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="text-muted-foreground text-sm">
              {feed.lastAccessedAt ? (
                <span>
                  Last accessed{" "}
                  {formatDistanceToNow(new Date(feed.lastAccessedAt), {
                    addSuffix: true,
                  })}
                  {feed.accessCount > 0 && (
                    <span> · {feed.accessCount} requests</span>
                  )}
                </span>
              ) : (
                <span>Not yet accessed</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRotateDialog(true)}
                disabled={isPending}
              >
                {rotateMutation.isPending ? (
                  <Spinner className="size-4" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Regenerate URL
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isPending}
                className="text-destructive hover:text-destructive"
              >
                {deleteMutation.isPending ? (
                  <Spinner className="size-4" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Delete Feed
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
                <Calendar className="size-4" />
                Enable Calendar Feed
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
            <AlertDialogTitle>Delete Calendar Feed?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your calendar feed. Any calendar
              subscriptions using this URL will stop working. You can enable a
              new feed later, but it will have a different URL.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Spinner />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
