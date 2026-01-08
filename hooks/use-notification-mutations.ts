"use client";

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
 * Strategy:
 * - Optimistically update the unread count
 * - Optimistically remove/clear items from the Inbox (filter=unread)
 * - Let invalidation/refetch populate the Archive (filter=read)
 */
export function useNotificationMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // NOTE: `notifications.list` is ONLY used as an infinite query in the popover.
  // We key against the same infinite-query keys to ensure optimistic updates and
  // invalidation actually hit the active cache entries.
  const pageSize = 20;
  const inboxListQueryKey = trpc.notifications.list.infiniteQueryOptions({
    limit: pageSize,
    filter: "unread",
  }).queryKey;
  const archiveListQueryKey = trpc.notifications.list.infiniteQueryOptions({
    limit: pageSize,
    filter: "read",
  }).queryKey;
  const countQueryKey = trpc.notifications.unreadCount.queryKey();

  const markRead = useMutation({
    mutationFn: trpc.notifications.markRead.mutationOptions().mutationFn,
    onMutate: async ({ id }): Promise<MutationContext> => {
      // Cancel queries to prevent race conditions
      await queryClient.cancelQueries({ queryKey: inboxListQueryKey });
      await queryClient.cancelQueries({ queryKey: archiveListQueryKey });
      await queryClient.cancelQueries({ queryKey: countQueryKey });

      // Snapshot previous state for rollback
      const previousCount = queryClient.getQueryData<number>(countQueryKey);
      const previousQueries: MutationContext["previousQueries"] = [
        [
          inboxListQueryKey,
          queryClient.getQueryData<InfiniteNotificationData>(inboxListQueryKey),
        ],
        [
          archiveListQueryKey,
          queryClient.getQueryData<InfiniteNotificationData>(
            archiveListQueryKey,
          ),
        ],
      ];

      // Check if notification is already read to avoid double-decrement
      const previousInbox = previousQueries[0]?.[1];
      const wasInInbox = !!previousInbox?.pages?.some((page) =>
        page.items.some((n) => n.id === id),
      );

      // Optimistically update count only if it was actually unread/in the inbox list
      if (wasInInbox) {
        queryClient.setQueryData<number>(countQueryKey, (old) => {
          if (typeof old !== "number") return old;
          return Math.max(0, old - 1);
        });
      }

      // Optimistically remove from inbox (since inbox is filter=unread)
      queryClient.setQueryData<InfiniteNotificationData>(
        inboxListQueryKey,
        (old) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((n) => n.id !== id),
            })),
          };
        },
      );

      // If the item already exists in archive cache (unlikely), ensure readAt is set
      queryClient.setQueryData<InfiniteNotificationData>(
        archiveListQueryKey,
        (old) => {
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
        },
      );

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
      void queryClient.invalidateQueries({ queryKey: inboxListQueryKey });
      void queryClient.invalidateQueries({ queryKey: archiveListQueryKey });
      void queryClient.invalidateQueries({ queryKey: countQueryKey });
    },
  });

  const markAllRead = useMutation({
    mutationFn: trpc.notifications.markAllRead.mutationOptions().mutationFn,
    onMutate: async (): Promise<MutationContext> => {
      await queryClient.cancelQueries({ queryKey: inboxListQueryKey });
      await queryClient.cancelQueries({ queryKey: archiveListQueryKey });
      await queryClient.cancelQueries({ queryKey: countQueryKey });

      // Snapshot previous state for rollback
      const previousCount = queryClient.getQueryData<number>(countQueryKey);
      const previousQueries: MutationContext["previousQueries"] = [
        [
          inboxListQueryKey,
          queryClient.getQueryData<InfiniteNotificationData>(inboxListQueryKey),
        ],
        [
          archiveListQueryKey,
          queryClient.getQueryData<InfiniteNotificationData>(
            archiveListQueryKey,
          ),
        ],
      ];

      // Optimistically clear count
      queryClient.setQueryData<number>(countQueryKey, 0);

      const now = new Date();

      // Optimistically clear inbox completely (filter=unread)
      queryClient.setQueryData<InfiniteNotificationData>(
        inboxListQueryKey,
        (old) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              nextCursor: undefined,
              items: [],
            })),
          };
        },
      );

      // For archive cache, ensure any loaded items are marked read
      queryClient.setQueryData<InfiniteNotificationData>(
        archiveListQueryKey,
        (old) => {
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
        },
      );

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
      void queryClient.invalidateQueries({ queryKey: inboxListQueryKey });
      void queryClient.invalidateQueries({ queryKey: archiveListQueryKey });
      void queryClient.invalidateQueries({ queryKey: countQueryKey });
    },
  });

  return { markRead, markAllRead };
}
