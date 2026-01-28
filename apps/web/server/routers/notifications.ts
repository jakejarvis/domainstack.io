import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { notificationsRepo } from "@/lib/db/repos";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

/** Schema for notification filter parameter */
const notificationFilterSchema = z
  .enum(["unread", "read", "all"])
  .default("all");

export const notificationsRouter = createTRPCRouter({
  /**
   * List notifications for the current user with cursor-based pagination.
   * @param filter - "unread" for inbox, "read" for archive, "all" for everything
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(), // notification ID to start from
        filter: notificationFilterSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, filter } = input;

      // Fetch one extra to determine if there's a next page
      const items = await notificationsRepo.getUserNotifications(
        ctx.user.id,
        limit + 1,
        cursor,
        filter,
      );

      let nextCursor: string | undefined;
      if (items.length > limit) {
        const nextItem = items.pop(); // Remove the extra item
        nextCursor = nextItem?.id;
      }

      return {
        items,
        nextCursor,
      };
    }),

  /**
   * Get unread notification count for badge display.
   */
  unreadCount: protectedProcedure.query(async ({ ctx }) =>
    notificationsRepo.getUnreadCount(ctx.user.id),
  ),

  /**
   * Mark a single notification as read.
   */
  markRead: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const success = await notificationsRepo.markAsRead(input.id, ctx.user.id);

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
    const count = await notificationsRepo.markAllAsRead(ctx.user.id);
    return { count };
  }),
});
