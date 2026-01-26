import {
  SiApple,
  SiAppstore,
  SiGoogle,
  SiProton,
} from "@icons-pack/react-simple-icons";
import {
  IconBrandOpenai,
  IconCalendarCheck,
  IconCalendarOff,
  IconChevronDown,
  IconInfoCircle,
  IconKey,
  IconRefresh,
} from "@tabler/icons-react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { useCallback, useState } from "react";
import { toast } from "sonner";
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
import { ButtonGroup } from "@/components/ui/button-group";
import { CopyableField } from "@/components/ui/copyable-field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

/**
 * Skeleton for calendar instructions.
 * Exported for use as Suspense fallback in parent components.
 */
export function CalendarInstructionsSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-9 w-full rounded-lg" />
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function CalendarInstructions({ className }: { className?: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showRotateDialog, setShowRotateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Query key for cache manipulation
  const feedQueryKey = trpc.user.getCalendarFeed.queryKey();

  // Query - auto-refresh every 30s to keep "last accessed" timestamp current
  // Uses Suspense for initial loading state; errors bubble to ErrorBoundary
  const { data: feed } = useSuspenseQuery({
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

  // With useSuspenseQuery, feed is guaranteed to be defined
  const isEnabled = feed.enabled && "feedUrl" in feed;

  const getIntegrations = useCallback((feedUrl: string | undefined) => {
    if (!feedUrl) {
      return [];
    }

    return [
      {
        id: "google",
        label: "Google",
        icon: SiGoogle,
        // https://jamesdoc.com/blog/2024/webcal/
        href: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedUrl.replace("https://", "webcal://"))}`,
      },
      {
        id: "apple",
        label: "macOS/iOS",
        icon: SiApple,
        // Apple uses webcal:// protocol which opens natively
        href: feedUrl.replace("https://", "webcal://"),
      },
      {
        id: "outlook",
        label: "Outlook",
        icon: (props: React.SVGProps<SVGSVGElement>) => (
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            role="img"
            aria-label="Microsoft"
            {...props}
          >
            <path d="M11.4 24H0V12.6h11.4zM24 24H12.6V12.6H24zM11.4 11.4H0V0h11.4zm12.6 0H12.6V0H24z" />
          </svg>
        ),
        href: `https://outlook.office.com/calendar/0/addfromweb?url=${encodeURIComponent(feedUrl.replace("https://", "webcal://"))}`,
      },
      {
        id: "proton",
        label: "Proton",
        icon: SiProton,
        // Proton doesn't support direct subscription URLs
        href: "https://proton.me/support/subscribe-to-external-calendar#subscribe-external-link",
      },
    ];
  }, []);

  const integrations = getIntegrations(feed?.feedUrl);

  return (
    <>
      <div className={className}>
        {/* Content - loading handled by Suspense, errors by ErrorBoundary */}
        {isEnabled ? (
          <div className="space-y-4">
            {/* Security warning */}
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-400">
              <IconKey className="size-4 shrink-0 translate-y-[4px]" />
              <div className="space-y-1 text-[13px]">
                <p className="my-0.5 font-semibold">
                  Treat this URL like a password!
                </p>
                <p>
                  Anyone with this link can view your verified domains. You can
                  invalidate it at any time by generating a fresh URL below.
                </p>
              </div>
            </div>

            {/* Feed URL */}
            <CopyableField
              label="Feed URL"
              value={feed.feedUrl}
              showLabel={false}
            />

            {/* Stats */}
            <div className="flex items-center gap-[5px] text-muted-foreground text-xs leading-none">
              <IconInfoCircle className="size-3 shrink-0" />
              {feed.lastAccessedAt ? (
                <span>
                  Last accessed{" "}
                  {formatDistanceToNowStrict(new Date(feed.lastAccessedAt), {
                    addSuffix: true,
                  })}
                </span>
              ) : (
                <span>Not accessed yet.</span>
              )}
            </div>

            {/* Actions */}
            <div className="@container/actions">
              <div className="grid @md/actions:grid-cols-3 grid-cols-2 gap-2 pt-1">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    nativeButton={false}
                    render={
                      <ButtonGroup className="@md/actions:col-span-1 col-span-2 flex w-full">
                        <Button variant="outline" className="flex-1">
                          <SiAppstore className="text-muted-foreground" />
                          Open In…
                        </Button>
                        <Button variant="outline" className="!px-2.5">
                          <IconChevronDown />
                        </Button>
                      </ButtonGroup>
                    }
                  />
                  <DropdownMenuContent
                    align="end"
                    className="w-[var(--anchor-width)] max-w-[215px] p-1"
                  >
                    {/* 2x2 Grid of calendar apps */}
                    <div className="grid w-full grid-cols-2 gap-1">
                      {integrations.map((integration) => {
                        const { id, label, icon: Icon, href } = integration;
                        const opensNatively = href.startsWith("webcal://");

                        return (
                          <DropdownMenuItem
                            key={id}
                            render={
                              <a
                                href={href}
                                target={opensNatively ? undefined : "_blank"}
                                rel={
                                  opensNatively
                                    ? undefined
                                    : "noopener noreferrer"
                                }
                                data-disable-progress={
                                  opensNatively ? true : undefined
                                }
                                className="flex w-full flex-col items-center justify-center gap-2.5 rounded-md py-4 text-center focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              >
                                <Icon className="size-5 text-foreground/90" />
                                <span className="text-foreground/75 text-xs leading-none">
                                  {label}
                                </span>
                              </a>
                            }
                          />
                        );
                      })}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      render={
                        <a
                          href={`https://chatgpt.com/?${new URLSearchParams({
                            hints: "search",
                            q: "How do I subscribe to an ics calendar feed in Microsoft Bob?",
                          })}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="justify-center text-[13px] text-foreground/90"
                          aria-label="Ask ChatGPT"
                        >
                          <IconBrandOpenai />
                          Other…
                          <span className="sr-only">(Ask ChatGPT)</span>
                        </a>
                      }
                    />
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="outline"
                  onClick={() => setShowRotateDialog(true)}
                  disabled={isPending}
                >
                  {rotateMutation.isPending ? (
                    <Spinner />
                  ) : (
                    <IconRefresh className="text-muted-foreground" />
                  )}
                  Regenerate URL
                </Button>

                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isPending}
                >
                  {deleteMutation.isPending ? <Spinner /> : <IconCalendarOff />}
                  Disable
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Button
            onClick={() => enableMutation.mutate()}
            disabled={isPending}
            className="w-full"
          >
            {enableMutation.isPending ? (
              <>
                <Spinner />
                Enabling…
              </>
            ) : (
              <>
                <IconCalendarCheck />
                Enable
              </>
            )}
          </Button>
        )}
      </div>

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
              {rotateMutation.isPending ? <Spinner /> : <IconRefresh />}
              Regenerate
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
              {deleteMutation.isPending ? <Spinner /> : <IconCalendarOff />}
              Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
