"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

type CalendarFeedData =
  | { enabled: false }
  | { enabled: true; feedUrl: string; lastAccessedAt: Date | null };

interface MutationCallbacks {
  onSuccess?: () => void;
}

export interface UseCalendarFeedReturn {
  /** The current feed data */
  feed: CalendarFeedData;
  /** Whether the feed is enabled and has a URL */
  isEnabled: boolean;
  /** Whether any mutation is in progress */
  isPending: boolean;
  /** Enable the calendar feed */
  enable: () => void;
  /** Disable the calendar feed (optimistic) */
  disable: () => void;
  /** Rotate the feed token to generate a new URL */
  rotate: {
    mutate: (callbacks?: MutationCallbacks) => void;
    isPending: boolean;
  };
  /** Delete the calendar feed (optimistic) */
  deleteFeed: {
    mutate: (callbacks?: MutationCallbacks) => void;
    isPending: boolean;
  };
}

/**
 * Hook for managing calendar feed data and mutations.
 * Encapsulates all TanStack Query logic for the calendar feed feature.
 *
 * Uses useSuspenseQuery - must be used within a Suspense boundary.
 */
export function useCalendarFeed(): UseCalendarFeedReturn {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Query key for cache manipulation
  const feedQueryKey = trpc.user.getCalendarFeed.queryKey();

  // Query - auto-refresh every 30s to keep "last accessed" timestamp current
  // Uses Suspense for initial loading state; errors bubble to ErrorBoundary
  const { data: feed } = useSuspenseQuery({
    ...trpc.user.getCalendarFeed.queryOptions(),
    refetchInterval: 30_000,
  });

  // Enable mutation
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

  // Disable mutation (optimistic)
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

  // Rotate token mutation
  const rotateMutation = useMutation({
    ...trpc.user.rotateCalendarFeedToken.mutationOptions(),
    onSuccess: () => {
      toast.success("Calendar feed URL regenerated");
    },
    onError: () => {
      toast.error("Failed to regenerate URL");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: feedQueryKey });
    },
  });

  // Delete mutation (optimistic)
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

  return {
    feed,
    isEnabled,
    isPending,
    enable: () => enableMutation.mutate(),
    disable: () => disableMutation.mutate(),
    rotate: {
      mutate: (callbacks?: MutationCallbacks) =>
        rotateMutation.mutate(undefined, { onSuccess: callbacks?.onSuccess }),
      isPending: rotateMutation.isPending,
    },
    deleteFeed: {
      mutate: (callbacks?: MutationCallbacks) =>
        deleteMutation.mutate(undefined, { onSuccess: callbacks?.onSuccess }),
      isPending: deleteMutation.isPending,
    },
  };
}
