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
  previousData?: InfiniteNotificationData | NotificationList;
  previousCount?: number;
};

/**
 * Shared mutations for notifications (mark as read, mark all as read).
 * Handles optimistic updates for both infinite queries (page) and standard queries (bell).
 */
export function useNotificationMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Query keys
  const listQueryKey = trpc.notifications.list.queryKey(); // Prefix for all list queries
  const countQueryKey = trpc.notifications.unreadCount.queryKey();

  const markRead = useMutation({
    mutationFn: trpc.notifications.markRead.mutationOptions().mutationFn,
    onMutate: async ({ id }): Promise<MutationContext> => {
      // Cancel all list queries (both infinite and fixed limit)
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      await queryClient.cancelQueries({ queryKey: countQueryKey });

      // Snapshot previous state
      const previousCount = queryClient.getQueryData<number>(countQueryKey);

      // Optimistically update count
      queryClient.setQueryData<number>(countQueryKey, (old) =>
        old ? Math.max(0, old - 1) : 0,
      );

      // Optimistically update all list queries
      queryClient.setQueriesData<InfiniteNotificationData | NotificationList>(
        { queryKey: listQueryKey },
        (old) => {
          if (!old) return old;

          // Handle InfiniteData (has pages)
          if ("pages" in old) {
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map((n) =>
                  n.id === id ? { ...n, readAt: new Date() } : n,
                ),
              })),
            };
          }

          // Handle standard NotificationList
          return {
            ...old,
            items: old.items.map((n) =>
              n.id === id ? { ...n, readAt: new Date() } : n,
            ),
          };
        },
      );

      // We only return the count snapshot because capturing ALL list query snapshots
      // is complex and broad invalidation is safer on error.
      return { previousCount };
    },
    onError: (_err, _variables, context) => {
      // Rollback count
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData<number>(countQueryKey, context.previousCount);
      }
      // Invalidate lists to ensure consistency since we didn't snapshot them all
      void queryClient.invalidateQueries({ queryKey: listQueryKey });
    },
    onSettled: async () => {
      // Always invalidate to ensure consistency
      await queryClient.invalidateQueries({ queryKey: listQueryKey });
      await queryClient.invalidateQueries({ queryKey: countQueryKey });
    },
  });

  const markAllRead = useMutation({
    mutationFn: trpc.notifications.markAllRead.mutationOptions().mutationFn,
    onMutate: async (): Promise<MutationContext> => {
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      await queryClient.cancelQueries({ queryKey: countQueryKey });

      const previousCount = queryClient.getQueryData<number>(countQueryKey);

      // Optimistically clear count
      queryClient.setQueryData<number>(countQueryKey, 0);

      // Optimistically update all list queries
      queryClient.setQueriesData<InfiniteNotificationData | NotificationList>(
        { queryKey: listQueryKey },
        (old) => {
          if (!old) return old;

          // Handle InfiniteData
          if ("pages" in old) {
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map((n) => ({ ...n, readAt: new Date() })),
              })),
            };
          }

          // Handle standard NotificationList
          return {
            ...old,
            items: old.items.map((n) => ({ ...n, readAt: new Date() })),
          };
        },
      );

      return { previousCount };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData<number>(countQueryKey, context.previousCount);
      }
      void queryClient.invalidateQueries({ queryKey: listQueryKey });
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: listQueryKey });
      await queryClient.invalidateQueries({ queryKey: countQueryKey });
    },
  });

  return { markRead, markAllRead };
}
