import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import {
  getUnreadCount,
  getUserNotifications,
  markAllAsRead,
  markAsRead,
} from "@domainstack/db/queries/notifications";

/** Schema for notification filter parameter */
const notificationFilterSchema = z.enum(["unread", "read", "all"]).default("all");

export const notificationsRouter = createTRPCRouter({
  /**
   * List notifications for the current user with cursor-based pagination.
   * @param filter - "unread" for inbox, "read" for archive, "all" for everything
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().nullish(), // React Query sends null on infinite invalidation
        filter: notificationFilterSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, filter } = input;

      // Fetch one extra to determine if there's a next page
      const items = await getUserNotifications(ctx.user.id, limit + 1, cursor ?? undefined, filter);

      // `getUserNotifications` treats the cursor as exclusive, so the next page
      // must resume from the last item we actually return. Using the dropped
      // look-ahead row here would skip it on the following page.
      let nextCursor: string | undefined;
      if (items.length > limit) {
        items.pop(); // Drop the extra look-ahead item
        nextCursor = items[items.length - 1]?.id;
      }

      return {
        items,
        nextCursor,
      };
    }),

  /**
   * Get unread notification count for badge display.
   */
  unreadCount: protectedProcedure.query(async ({ ctx }) => getUnreadCount(ctx.user.id)),

  /**
   * Mark a single notification as read.
   */
  markRead: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const success = await markAsRead(input.id, ctx.user.id);

      if (!success) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Notification not found",
        });
      }

      return { success: true };
    }),

  /**
   * Mark all notifications as read for the current user.
   */
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const count = await markAllAsRead(ctx.user.id);
    return { count };
  }),
});
