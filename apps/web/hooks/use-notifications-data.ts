"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

const PAGE_SIZE = 20;

type UseNotificationsDataOptions = {
  /** The current filter view */
  filter: "unread" | "read";
  /** Whether the popover is open (gates fetching) */
  enabled: boolean;
};

/**
 * Hook for notifications data fetching and mutations.
 * Encapsulates all TanStack Query logic for the notifications popover.
 */
export function useNotificationsData({
  filter,
  enabled,
}: UseNotificationsDataOptions) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Query keys for cache manipulation
  const inboxListQueryKey = trpc.notifications.list.infiniteQueryOptions({
    limit: PAGE_SIZE,
    filter: "unread",
  }).queryKey;
  const archiveListQueryKey = trpc.notifications.list.infiniteQueryOptions({
    limit: PAGE_SIZE,
    filter: "read",
  }).queryKey;
  const countQueryKey = trpc.notifications.unreadCount.queryKey();

  // Mark single notification as read
  const markRead = useMutation({
    mutationFn: trpc.notifications.markRead.mutationOptions().mutationFn,
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: inboxListQueryKey });
      await queryClient.cancelQueries({ queryKey: archiveListQueryKey });
      await queryClient.cancelQueries({ queryKey: countQueryKey });

      const previousCount = queryClient.getQueryData(countQueryKey);
      const previousInbox = queryClient.getQueryData(inboxListQueryKey);
      const previousArchive = queryClient.getQueryData(archiveListQueryKey);

      const wasInInbox = previousInbox?.pages?.some((page) =>
        page.items.some((n) => n.id === id),
      );

      if (wasInInbox) {
        queryClient.setQueryData(countQueryKey, (old: number | undefined) =>
          typeof old === "number" ? Math.max(0, old - 1) : old,
        );
      }

      queryClient.setQueryData(inboxListQueryKey, (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.filter((n) => n.id !== id),
          })),
        };
      });

      queryClient.setQueryData(archiveListQueryKey, (old) => {
        if (!old?.pages) return old;
        const now = new Date();
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((n) =>
              n.id === id ? { ...n, readAt: n.readAt ?? now } : n,
            ),
          })),
        };
      });

      return { previousCount, previousInbox, previousArchive };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(countQueryKey, context.previousCount);
      }
      if (context?.previousInbox) {
        queryClient.setQueryData(inboxListQueryKey, context.previousInbox);
      }
      if (context?.previousArchive) {
        queryClient.setQueryData(archiveListQueryKey, context.previousArchive);
      }
      toast.error("Failed to mark notification as read");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: inboxListQueryKey });
      void queryClient.invalidateQueries({ queryKey: archiveListQueryKey });
      void queryClient.invalidateQueries({ queryKey: countQueryKey });
    },
  });

  // Mark all notifications as read
  const markAllRead = useMutation({
    mutationFn: trpc.notifications.markAllRead.mutationOptions().mutationFn,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: inboxListQueryKey });
      await queryClient.cancelQueries({ queryKey: archiveListQueryKey });
      await queryClient.cancelQueries({ queryKey: countQueryKey });

      const previousCount = queryClient.getQueryData(countQueryKey);
      const previousInbox = queryClient.getQueryData(inboxListQueryKey);
      const previousArchive = queryClient.getQueryData(archiveListQueryKey);

      queryClient.setQueryData(countQueryKey, 0);

      queryClient.setQueryData(inboxListQueryKey, (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            nextCursor: undefined,
            items: [],
          })),
        };
      });

      const now = new Date();
      queryClient.setQueryData(archiveListQueryKey, (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((n) => ({
              ...n,
              readAt: n.readAt ?? now,
            })),
          })),
        };
      });

      return { previousCount, previousInbox, previousArchive };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(countQueryKey, context.previousCount);
      }
      if (context?.previousInbox) {
        queryClient.setQueryData(inboxListQueryKey, context.previousInbox);
      }
      if (context?.previousArchive) {
        queryClient.setQueryData(archiveListQueryKey, context.previousArchive);
      }
      toast.error("Failed to mark notifications as read");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: inboxListQueryKey });
      void queryClient.invalidateQueries({ queryKey: archiveListQueryKey });
      void queryClient.invalidateQueries({ queryKey: countQueryKey });
    },
  });

  // Get unread count for inbox
  const { data: count = 0 } = useQuery({
    ...trpc.notifications.unreadCount.queryOptions(),
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  // Get notifications with infinite scrolling
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    ...trpc.notifications.list.infiniteQueryOptions({
      limit: PAGE_SIZE,
      filter,
    }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    refetchOnWindowFocus: true,
    // Always refetch on mount/access to ensure fresh data
    staleTime: 0,
    // Base UI popover keeps content mounted for close animations; gate fetching on open
    enabled,
  });

  const notifications = data?.pages.flatMap((page) => page.items) ?? [];

  // Show loading skeleton when initially loading OR when fetching a tab that
  // has never been viewed (no cached data). Once a tab has cached data (even
  // if empty), show that cached state while refetching in the background.
  const showLoading = isLoading || (isFetching && data === undefined);

  // Helper to get latest unread count from cache
  const getLatestUnreadCount = () =>
    queryClient.getQueryData<number>(countQueryKey) ?? count;

  return {
    // Data
    notifications,
    count,
    // Loading states
    showLoading,
    hasNextPage,
    isFetchingNextPage,
    isError,
    // Mutations
    markRead,
    markAllRead,
    // Actions
    fetchNextPage,
    getLatestUnreadCount,
  };
}
