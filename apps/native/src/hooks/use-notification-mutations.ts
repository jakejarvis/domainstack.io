import { type InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { useTRPC } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { RouterOutputs } from "@domainstack/api";

const PAGE_SIZE = 20;

type NotificationListPage = RouterOutputs["notifications"]["list"];
// Cursor type mirrors tRPC's `TRPCInfiniteData` (pageParam is `string | null`),
// so `setQueryData`/`getQueryData` line up with the infinite query's cache.
type InfinitePages = InfiniteData<NotificationListPage, string | null>;

/**
 * Owns the optimistic `markRead` / `markAllRead` mutations plus the shared
 * `invalidate`. Extracted from the notifications screen so the list component
 * stays focused on rendering. The unread-count badge and all three filter
 * caches (unread/read/all) are reconciled together so a read elsewhere stays
 * consistent no matter which tab is active.
 */
export function useNotificationMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const listKeys = useMemo(
    () => ({
      all: trpc.notifications.list.infiniteQueryOptions(
        { filter: "all", limit: PAGE_SIZE },
        { getNextPageParam: (lastPage) => lastPage.nextCursor },
      ).queryKey,
      read: trpc.notifications.list.infiniteQueryOptions(
        { filter: "read", limit: PAGE_SIZE },
        { getNextPageParam: (lastPage) => lastPage.nextCursor },
      ).queryKey,
      unread: trpc.notifications.list.infiniteQueryOptions(
        { filter: "unread", limit: PAGE_SIZE },
        { getNextPageParam: (lastPage) => lastPage.nextCursor },
      ).queryKey,
    }),
    [trpc.notifications.list],
  );
  const countKey = trpc.notifications.unreadCount.queryKey();

  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.notifications.list.queryKey() }),
      queryClient.invalidateQueries({ queryKey: countKey }),
    ]);
  }, [queryClient, trpc.notifications.list, countKey]);

  const markRead = useMutation({
    mutationFn: trpc.notifications.markRead.mutationOptions().mutationFn,
    onMutate: async ({ id }: { id: string }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKeys.unread }),
        queryClient.cancelQueries({ queryKey: listKeys.read }),
        queryClient.cancelQueries({ queryKey: listKeys.all }),
        queryClient.cancelQueries({ queryKey: countKey }),
      ]);

      const previousUnread = queryClient.getQueryData<InfinitePages>(listKeys.unread);
      const previousRead = queryClient.getQueryData<InfinitePages>(listKeys.read);
      const previousAll = queryClient.getQueryData<InfinitePages>(listKeys.all);
      const previousCount = queryClient.getQueryData<number>(countKey);

      const wasInUnread = previousUnread?.pages.some((page) => page.items.some((n) => n.id === id));

      if (wasInUnread) {
        queryClient.setQueryData<number | undefined>(countKey, (old) =>
          typeof old === "number" ? Math.max(0, old - 1) : old,
        );
      }

      queryClient.setQueryData<InfinitePages | undefined>(listKeys.unread, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.filter((n) => n.id !== id),
          })),
        };
      });

      const now = new Date();
      const flipReadAt = (old: InfinitePages | undefined): InfinitePages | undefined => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? now } : n)),
          })),
        };
      };
      queryClient.setQueryData<InfinitePages | undefined>(listKeys.read, flipReadAt);
      queryClient.setQueryData<InfinitePages | undefined>(listKeys.all, flipReadAt);

      return { previousUnread, previousRead, previousAll, previousCount };
    },
    onError: (err, _vars, context) => {
      if (context?.previousUnread !== undefined) {
        queryClient.setQueryData(listKeys.unread, context.previousUnread);
      }
      if (context?.previousRead !== undefined) {
        queryClient.setQueryData(listKeys.read, context.previousRead);
      }
      if (context?.previousAll !== undefined) {
        queryClient.setQueryData(listKeys.all, context.previousAll);
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(countKey, context.previousCount);
      }
      toast.error({ title: "Failed to mark read", message: err.message });
    },
    onSettled: () => void invalidate(),
  });

  const markAllRead = useMutation({
    mutationFn: trpc.notifications.markAllRead.mutationOptions().mutationFn,
    onMutate: async () => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKeys.unread }),
        queryClient.cancelQueries({ queryKey: listKeys.read }),
        queryClient.cancelQueries({ queryKey: listKeys.all }),
        queryClient.cancelQueries({ queryKey: countKey }),
      ]);

      const previousUnread = queryClient.getQueryData<InfinitePages>(listKeys.unread);
      const previousRead = queryClient.getQueryData<InfinitePages>(listKeys.read);
      const previousAll = queryClient.getQueryData<InfinitePages>(listKeys.all);
      const previousCount = queryClient.getQueryData<number>(countKey);

      queryClient.setQueryData<number>(countKey, 0);

      queryClient.setQueryData<InfinitePages | undefined>(listKeys.unread, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({ ...page, items: [], nextCursor: undefined })),
        };
      });

      const now = new Date();
      const markEveryRead = (old: InfinitePages | undefined): InfinitePages | undefined => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((n) => ({ ...n, readAt: n.readAt ?? now })),
          })),
        };
      };
      queryClient.setQueryData<InfinitePages | undefined>(listKeys.read, markEveryRead);
      queryClient.setQueryData<InfinitePages | undefined>(listKeys.all, markEveryRead);

      return { previousUnread, previousRead, previousAll, previousCount };
    },
    onError: (err, _vars, context) => {
      if (context?.previousUnread !== undefined) {
        queryClient.setQueryData(listKeys.unread, context.previousUnread);
      }
      if (context?.previousRead !== undefined) {
        queryClient.setQueryData(listKeys.read, context.previousRead);
      }
      if (context?.previousAll !== undefined) {
        queryClient.setQueryData(listKeys.all, context.previousAll);
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(countKey, context.previousCount);
      }
      toast.error({ title: "Failed to mark all read", message: err.message });
    },
    onSettled: () => void invalidate(),
  });

  return { invalidate, markAllRead, markRead };
}
