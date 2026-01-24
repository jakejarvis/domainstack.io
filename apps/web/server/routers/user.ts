import { TRPCError } from "@trpc/server";
import z from "zod";
import { analytics } from "@/lib/analytics/server";
import { BASE_URL } from "@/lib/constants/app";
import {
  deleteCalendarFeed,
  disableCalendarFeed,
  enableCalendarFeed,
  getCalendarFeed,
  rotateCalendarFeedToken,
} from "@/lib/db/repos/calendar-feeds";
import {
  countTrackedDomainsByStatus,
  findTrackedDomainById,
  setDomainMuted,
} from "@/lib/db/repos/tracked-domains";
import {
  getOrCreateUserNotificationPreferences,
  updateUserNotificationPreferences,
} from "@/lib/db/repos/user-notification-preferences";
import { getUserSubscription } from "@/lib/db/repos/user-subscription";
import { getLinkedAccounts } from "@/lib/db/repos/users";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

const NotificationChannelsSchema = z.object({
  inApp: z.boolean(),
  email: z.boolean(),
});

const UserNotificationPreferencesSchema = z
  .object({
    domainExpiry: NotificationChannelsSchema,
    certificateExpiry: NotificationChannelsSchema,
    registrationChanges: NotificationChannelsSchema,
    providerChanges: NotificationChannelsSchema,
    certificateChanges: NotificationChannelsSchema,
  })
  .partial();

/**
 * Build the full calendar feed URL from a token.
 */
function buildCalendarFeedUrl(token: string): string {
  return `${BASE_URL}/dashboard/feed.ics?token=${encodeURIComponent(token)}`;
}

export const userRouter = createTRPCRouter({
  /**
   * Get the user's linked OAuth accounts.
   * Returns only provider IDs for security (no tokens or sensitive data).
   */
  getLinkedAccounts: protectedProcedure.query(async ({ ctx }) =>
    getLinkedAccounts(ctx.user.id),
  ),

  /**
   * Get user's subscription data including tier, limits, and current usage.
   * Optimized to run all queries in parallel.
   */
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    // Run all independent queries in parallel for better performance
    const [subscription, counts] = await Promise.all([
      getUserSubscription(ctx.user.id),
      countTrackedDomainsByStatus(ctx.user.id),
    ]);

    return {
      plan: subscription.plan,
      planQuota: subscription.planQuota,
      // When a canceled subscription expires (null = no pending cancellation)
      endsAt: subscription.endsAt,
      activeCount: counts.active,
      archivedCount: counts.archived,
      // Only active domains count against limit
      canAddMore: counts.active < subscription.planQuota,
    };
  }),

  /**
   * Get global notification preferences for the current user.
   */
  getNotificationPreferences: protectedProcedure.query(async ({ ctx }) => {
    const prefs = await getOrCreateUserNotificationPreferences(ctx.user.id);
    return prefs;
  }),

  /**
   * Update global notification preferences.
   * Accepts partial updates - only provided fields will be changed.
   */
  updateGlobalNotificationPreferences: protectedProcedure
    .input(UserNotificationPreferencesSchema)
    .mutation(async ({ ctx, input }) => {
      const updated = await updateUserNotificationPreferences(
        ctx.user.id,
        input,
      );

      analytics.track(
        "notification_preferences_updated",
        { ...input },
        ctx.user.id,
      );

      return updated;
    }),

  /**
   * Set muted state for a specific tracked domain.
   * Muted domains receive no notifications.
   */
  setDomainMuted: protectedProcedure
    .input(
      z.object({
        trackedDomainId: z.string().uuid(),
        muted: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { trackedDomainId, muted } = input;

      // Get tracked domain and verify ownership in one check
      // Return identical error for both "not found" and "wrong user"
      // to prevent enumeration attacks via error differentiation
      const tracked = await findTrackedDomainById(trackedDomainId);
      if (!tracked || tracked.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tracked domain not found",
        });
      }

      const updated = await setDomainMuted(trackedDomainId, muted);

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Failed to update domain - it may have been deleted",
        });
      }

      analytics.track(
        muted ? "domain_muted" : "domain_unmuted",
        {},
        ctx.user.id,
      );

      return {
        id: updated.id,
        muted: updated.muted,
      };
    }),

  // ============================================================================
  // Calendar Feed Procedures
  // ============================================================================

  /**
   * Get the user's calendar feed status and URL.
   * Returns the full feed URL if enabled (token is stored retrievably).
   */
  getCalendarFeed: protectedProcedure.query(async ({ ctx }) => {
    const feed = await getCalendarFeed(ctx.user.id);

    if (!feed) {
      return { enabled: false } as const;
    }

    return {
      enabled: feed.enabled,
      feedUrl: buildCalendarFeedUrl(feed.token),
      lastAccessedAt: feed.lastAccessedAt,
    };
  }),

  /**
   * Enable the calendar feed for the user.
   * Creates a new feed with a fresh token if one doesn't exist,
   * or re-enables an existing disabled feed.
   */
  enableCalendarFeed: protectedProcedure.mutation(async ({ ctx }) => {
    const feed = await enableCalendarFeed(ctx.user.id);

    analytics.track("calendar_feed_enabled", {}, ctx.user.id);

    return {
      feedUrl: buildCalendarFeedUrl(feed.token),
      createdAt: feed.createdAt,
    };
  }),

  /**
   * Disable the calendar feed for the user.
   * The token is preserved so the feed can be re-enabled later with the same URL.
   */
  disableCalendarFeed: protectedProcedure.mutation(async ({ ctx }) => {
    const feed = await disableCalendarFeed(ctx.user.id);

    if (!feed) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Calendar feed not found",
      });
    }

    analytics.track("calendar_feed_disabled", {}, ctx.user.id);

    return { success: true };
  }),

  /**
   * Rotate the calendar feed token, generating a new URL.
   * The old URL will immediately stop working.
   */
  rotateCalendarFeedToken: protectedProcedure.mutation(async ({ ctx }) => {
    const feed = await rotateCalendarFeedToken(ctx.user.id);

    if (!feed) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Calendar feed not found",
      });
    }

    analytics.track("calendar_feed_rotated", {}, ctx.user.id);

    return {
      feedUrl: buildCalendarFeedUrl(feed.token),
      rotatedAt: feed.rotatedAt,
    };
  }),

  /**
   * Delete the calendar feed entirely.
   * Used when user wants to completely remove the feed rather than just disable it.
   */
  deleteCalendarFeed: protectedProcedure.mutation(async ({ ctx }) => {
    const deleted = await deleteCalendarFeed(ctx.user.id);

    if (!deleted) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Calendar feed not found",
      });
    }

    analytics.track("calendar_feed_deleted", {}, ctx.user.id);

    return { success: true };
  }),
});
