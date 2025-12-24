"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferProcedureOutput } from "@trpc/server";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import type { AppRouter } from "@/server/routers/_app";

type NotificationList = inferProcedureOutput<
  AppRouter["notifications"]["list"]
>;
type Notification = NotificationList["items"][number];

type MutationContext = {
  previousNotifications?: NotificationList;
  previousCount?: number;
};

export function NotificationBell() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Query keys
  const listQueryKey = trpc.notifications.list.queryKey({ limit: 10 });
  const countQueryKey = trpc.notifications.unreadCount.queryKey();

  // Get unread count
  const { data: count = 0 } = useQuery({
    ...trpc.notifications.unreadCount.queryOptions(),
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });

  // Get recent notifications (just first page)
  const { data: notifications } = useQuery({
    ...trpc.notifications.list.queryOptions({ limit: 10 }),
    refetchOnWindowFocus: true,
    select: (data) => data.items,
  });

  const markRead = useMutation({
    mutationFn: trpc.notifications.markRead.mutationOptions().mutationFn,
    onMutate: async ({ id }): Promise<MutationContext> => {
      await queryClient.cancelQueries({
        queryKey: trpc.notifications.list.queryKey(),
      });
      const previousNotifications =
        queryClient.getQueryData<NotificationList>(listQueryKey);

      queryClient.setQueryData<NotificationList>(listQueryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((n) =>
            n.id === id ? { ...n, readAt: new Date() } : n,
          ),
        };
      });

      await queryClient.cancelQueries({ queryKey: countQueryKey });
      const previousCount = queryClient.getQueryData<number>(countQueryKey);
      queryClient.setQueryData<number>(countQueryKey, (old) =>
        old ? Math.max(0, old - 1) : 0,
      );

      return { previousNotifications, previousCount };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData<NotificationList>(
          listQueryKey,
          context.previousNotifications,
        );
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData<number>(countQueryKey, context.previousCount);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: trpc.notifications.list.queryKey(),
      });
      await queryClient.invalidateQueries({ queryKey: countQueryKey });
    },
  });

  const markAllRead = useMutation({
    mutationFn: trpc.notifications.markAllRead.mutationOptions().mutationFn,
    onMutate: async (): Promise<MutationContext> => {
      await queryClient.cancelQueries({
        queryKey: trpc.notifications.list.queryKey(),
      });
      const previousNotifications =
        queryClient.getQueryData<NotificationList>(listQueryKey);

      queryClient.setQueryData<NotificationList>(listQueryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((n) => ({ ...n, readAt: new Date() })),
        };
      });

      await queryClient.cancelQueries({ queryKey: countQueryKey });
      const previousCount = queryClient.getQueryData<number>(countQueryKey);
      queryClient.setQueryData<number>(countQueryKey, 0);

      return { previousNotifications, previousCount };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData<NotificationList>(
          listQueryKey,
          context.previousNotifications,
        );
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData<number>(countQueryKey, context.previousCount);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: trpc.notifications.list.queryKey(),
      });
      await queryClient.invalidateQueries({ queryKey: countQueryKey });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.readAt) {
      markRead.mutate({ id: notification.id });
    }
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
          />
        }
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span
            className="absolute top-2 right-2 size-2 rounded-full bg-destructive ring-2 ring-background"
            aria-hidden="true"
          />
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 text-xs"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          {!notifications || notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No notifications yet
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "w-full p-4 text-left text-sm transition-colors hover:bg-muted/50",
                    !notification.readAt && "bg-muted/30",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium leading-none">
                          {notification.title}
                        </span>
                        {!notification.readAt && (
                          <span
                            className="size-1.5 rounded-full bg-blue-500"
                            role="status"
                            aria-label="Unread"
                          />
                        )}
                      </div>
                      <p className="line-clamp-2 text-muted-foreground">
                        {notification.message}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatDistanceToNow(notification.sentAt, {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications && notifications.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              nativeButton={false}
              render={<Link href="/notifications" />}
            >
              View all notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
