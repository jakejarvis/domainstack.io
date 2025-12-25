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
};

/**
 * Shared mutations for notifications (mark as read, mark all as read).
 * Handles optimistic updates for the notification bell's infinite query.
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
      // Cancel queries to prevent race conditions
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      await queryClient.cancelQueries({ queryKey: countQueryKey });

      // Snapshot previous count
      const previousCount = queryClient.getQueryData<number>(countQueryKey);

      // Check if notification is already read to avoid double-decrement
      let isAlreadyRead = false;
      const queries = queryClient.getQueriesData<InfiniteNotificationData>({
        queryKey: listQueryKey,
      });

      for (const [, data] of queries) {
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

      // Optimistically update all list queries (infinite queries)
      queryClient.setQueriesData<InfiniteNotificationData>(
        { queryKey: listQueryKey },
        (old) => {
          if (!old?.pages) return old;

          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((n) =>
                n.id === id ? { ...n, readAt: new Date() } : n,
              ),
            })),
          };
        },
      );

      return { previousCount };
    },
    onError: (_err, _variables, context) => {
      // Rollback count on error
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData<number>(countQueryKey, context.previousCount);
      }
      // Invalidate to ensure consistency
      void queryClient.invalidateQueries({ queryKey: listQueryKey });
    },
    onSuccess: () => {
      // Invalidate to trigger refetch and ensure server sync
      void queryClient.invalidateQueries({ queryKey: listQueryKey });
      void queryClient.invalidateQueries({ queryKey: countQueryKey });
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

      // Optimistically update all list queries (infinite queries)
      queryClient.setQueriesData<InfiniteNotificationData>(
        { queryKey: listQueryKey },
        (old) => {
          if (!old?.pages) return old;

          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((n) => ({ ...n, readAt: new Date() })),
            })),
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
    onSuccess: () => {
      // Invalidate to trigger refetch and ensure server sync
      void queryClient.invalidateQueries({ queryKey: listQueryKey });
      void queryClient.invalidateQueries({ queryKey: countQueryKey });
    },
  });

  return { markRead, markAllRead };
}
