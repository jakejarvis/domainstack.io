import {
  type InfiniteData,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { inferProcedureOutput } from "@trpc/server";
import { useTRPC } from "@/lib/trpc/client";
import type { AppRouter } from "@/server/routers/_app";

type NotificationList = inferProcedureOutput<
  AppRouter["notifications"]["list"]
>;

type InfiniteNotificationData = InfiniteData<NotificationList>;

type MutationContext = {
  previousCount?: number;
  previousQueries?: Array<
    [readonly unknown[], InfiniteNotificationData | undefined]
  >;
};

/**
 * Shared mutations for notifications (mark as read, mark all as read).
 * Handles optimistic updates for the notification bell's infinite query.
 *
 * Strategy: Instead of trying to perfectly maintain cache consistency
 * (adding to archive, removing from inbox), we:
 * 1. Do minimal optimistic updates for immediate visual feedback
 * 2. Mark queries stale so they refetch on next access
 * 3. This is simpler and avoids complex cache manipulation bugs
 */
export function useNotificationMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Query keys (prefix for all list queries)
  const listQueryKey = trpc.notifications.list.queryKey();
  const countQueryKey = trpc.notifications.unreadCount.queryKey();

  const markRead = useMutation({
    mutationFn: trpc.notifications.markRead.mutationOptions().mutationFn,
    onMutate: async ({ id }): Promise<MutationContext> => {
      // Cancel queries to prevent race conditions
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      await queryClient.cancelQueries({ queryKey: countQueryKey });

      // Snapshot previous state for rollback
      const previousCount = queryClient.getQueryData<number>(countQueryKey);
      const previousQueries =
        queryClient.getQueriesData<InfiniteNotificationData>({
          queryKey: listQueryKey,
        });

      // Check if notification is already read to avoid double-decrement
      let isAlreadyRead = false;
      for (const [, data] of previousQueries) {
        if (!data?.pages) continue;
        for (const page of data.pages) {
          const notification = page.items.find((n) => n.id === id);
          if (notification?.readAt) {
            isAlreadyRead = true;
            break;
          }
        }
        if (isAlreadyRead) break;
      }

      // Optimistically update count only if not already read
      if (!isAlreadyRead) {
        queryClient.setQueryData<number>(countQueryKey, (old) =>
          old ? Math.max(0, old - 1) : 0,
        );
      }

      // Optimistically update all list queries - just set readAt on the notification
      // Don't try to add/remove from different views - let invalidation handle that
      for (const [key, old] of previousQueries) {
        if (!old?.pages) continue;

        queryClient.setQueryData<InfiniteNotificationData>(key, {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((n) =>
              n.id === id ? { ...n, readAt: new Date() } : n,
            ),
          })),
        });
      }

      // Mark all list queries as stale (but don't refetch yet)
      // This ensures they'll refetch when the user switches views
      void queryClient.invalidateQueries({
        queryKey: listQueryKey,
        refetchType: "none",
      });

      return { previousCount, previousQueries };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData<number>(countQueryKey, context.previousCount);
      }
      // Rollback list queries
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData<InfiniteNotificationData>(key, data);
        }
      }
    },
    onSettled: () => {
      // Invalidate to ensure consistency with server
      void queryClient.invalidateQueries({ queryKey: listQueryKey });
      void queryClient.invalidateQueries({ queryKey: countQueryKey });
    },
  });

  const markAllRead = useMutation({
    mutationFn: trpc.notifications.markAllRead.mutationOptions().mutationFn,
    onMutate: async (): Promise<MutationContext> => {
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      await queryClient.cancelQueries({ queryKey: countQueryKey });

      // Snapshot previous state for rollback
      const previousCount = queryClient.getQueryData<number>(countQueryKey);
      const previousQueries =
        queryClient.getQueriesData<InfiniteNotificationData>({
          queryKey: listQueryKey,
        });

      // Optimistically clear count
      queryClient.setQueryData<number>(countQueryKey, 0);

      // Optimistically update all list queries - mark everything as read
      for (const [key, old] of previousQueries) {
        if (!old?.pages) continue;

        queryClient.setQueryData<InfiniteNotificationData>(key, {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((n) => ({
              ...n,
              readAt: n.readAt ?? new Date(),
            })),
          })),
        });
      }

      // Mark all list queries as stale
      void queryClient.invalidateQueries({
        queryKey: listQueryKey,
        refetchType: "none",
      });

      return { previousCount, previousQueries };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData<number>(countQueryKey, context.previousCount);
      }
      // Rollback list queries
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData<InfiniteNotificationData>(key, data);
        }
      }
    },
    onSettled: () => {
      // Invalidate to trigger refetch and ensure server sync
      void queryClient.invalidateQueries({ queryKey: listQueryKey });
      void queryClient.invalidateQueries({ queryKey: countQueryKey });
    },
  });

  return { markRead, markAllRead };
}
