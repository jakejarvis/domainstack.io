import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  getUnreadCount,
  getUserNotifications,
  markAllAsRead,
  markAsRead,
} from "@domainstack/db/queries/notifications";

import { protectedProcedure } from "../procedures";
import { createTRPCRouter } from "../trpc";

/** Schema for notification filter parameter */
const notificationFilterSchema = z.enum(["unread", "read", "all"]).default("all");

/**
 * Opaque pagination cursor: `<sentAt ISO>_<id>`, decoded into the keyset the
 * query needs. Malformed values fail input validation (BAD_REQUEST).
 */
const cursorSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z_[0-9a-f-]{36}$/i, "Invalid cursor")
  .transform((raw) => {
    const [iso = "", id = ""] = raw.split("_");
    return { sentAt: new Date(iso), id };
  })
  .refine((c) => !Number.isNaN(c.sentAt.getTime()), "Invalid cursor")
  .nullish(); // React Query sends null on infinite invalidation

export const notificationsRouter = createTRPCRouter({
  /**
   * List notifications for the current user with cursor-based pagination.
   * @param filter - "unread" for inbox, "read" for archive, "all" for everything
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        cursor: cursorSchema,
        filter: notificationFilterSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, filter } = input;

      // Fetch one extra to determine if there's a next page
      const items = await getUserNotifications(ctx.user.id, limit + 1, cursor ?? undefined, filter);

      // `getUserNotifications` treats the cursor as exclusive, so the next page
      // must resume from the last item we actually return. Using the dropped
      // look-ahead row here would skip it on the following page. The cursor
      // carries `sentAt` too, so it survives the row being deleted meanwhile.
      let nextCursor: string | undefined;
      if (items.length > limit) {
        items.pop(); // Drop the extra look-ahead item
        const last = items[items.length - 1];
        nextCursor = last ? `${last.sentAt.toISOString()}_${last.id}` : undefined;
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
   * Mark unread notifications as read for the current user. With `upTo`, only
   * notifications sent at or before that time are marked.
   */
  markAllRead: protectedProcedure
    .input(z.object({ upTo: z.date().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const count = await markAllAsRead(ctx.user.id, input?.upTo);
      return { count };
    }),
});
