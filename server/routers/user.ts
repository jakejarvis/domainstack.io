import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import z from "zod";
import { analytics } from "@/lib/analytics/server";
import { BASE_URL } from "@/lib/constants";
import { db } from "@/lib/db/client";
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
  resetNotificationOverrides,
} from "@/lib/db/repos/tracked-domains";
import {
  getOrCreateUserNotificationPreferences,
  updateUserNotificationPreferences,
} from "@/lib/db/repos/user-notification-preferences";
import { getUserSubscription } from "@/lib/db/repos/user-subscription";
import { accounts, userTrackedDomains } from "@/lib/db/schema";
import { getMaxDomainsForTier } from "@/lib/edge-config";
import {
  NotificationOverridesSchema,
  UpdateNotificationPreferencesSchema,
} from "@/lib/schemas";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

/**
 * Build the full calendar feed URL from a token.
 */
function buildCalendarFeedUrl(token: string): string {
  return `${BASE_URL}/dashboard/feed.ics?token=${token}`;
}

export const userRouter = createTRPCRouter({
  /**
   * Get the user's linked OAuth accounts.
   * Returns only provider IDs for security (no tokens or sensitive data).
   */
  getLinkedAccounts: protectedProcedure.query(async ({ ctx }) => {
    const linkedAccounts = await db
      .select({
        providerId: accounts.providerId,
        createdAt: accounts.createdAt,
      })
      .from(accounts)
      .where(eq(accounts.userId, ctx.user.id));

    return linkedAccounts.map((account) => ({
      providerId: account.providerId,
      createdAt: account.createdAt,
    }));
  }),

  /**
   * Get user's subscription data including tier, limits, and current usage.
   * Optimized to run all queries in parallel.
   */
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    // Run all independent queries in parallel for better performance
    const [sub, counts, proMaxDomains] = await Promise.all([
      getUserSubscription(ctx.user.id),
      countTrackedDomainsByStatus(ctx.user.id),
      getMaxDomainsForTier("pro"),
    ]);

    return {
      tier: sub.tier,
      maxDomains: sub.maxDomains,
      activeCount: counts.active,
      archivedCount: counts.archived,
      // Only active domains count against limit
      canAddMore: counts.active < sub.maxDomains,
      // When a canceled subscription expires (null = no pending cancellation)
      subscriptionEndsAt: sub.endsAt,
      // Pro tier limit for upgrade prompts
      proMaxDomains,
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
    .input(UpdateNotificationPreferencesSchema)
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
   * Update notification overrides for a specific tracked domain.
   * Optimized to avoid double lookup by passing existing overrides directly.
   */
  updateDomainNotificationOverrides: protectedProcedure
    .input(
      z.object({
        trackedDomainId: z.string().uuid(),
        overrides: NotificationOverridesSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { trackedDomainId, overrides } = input;

      // Get tracked domain (single lookup)
      const tracked = await findTrackedDomainById(trackedDomainId);
      if (!tracked) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tracked domain not found",
        });
      }

      // Ensure user owns this tracked domain
      if (tracked.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this domain",
        });
      }

      // Merge existing overrides with new ones (avoiding second lookup)
      // Use Object.hasOwn to detect explicit undefined (clear override) vs missing key
      const mergedOverrides = {
        ...tracked.notificationOverrides,
      };

      if (Object.hasOwn(overrides, "domainExpiry")) {
        mergedOverrides.domainExpiry = overrides.domainExpiry;
      }
      if (Object.hasOwn(overrides, "certificateExpiry")) {
        mergedOverrides.certificateExpiry = overrides.certificateExpiry;
      }
      if (Object.hasOwn(overrides, "registrationChanges")) {
        mergedOverrides.registrationChanges = overrides.registrationChanges;
      }
      if (Object.hasOwn(overrides, "providerChanges")) {
        mergedOverrides.providerChanges = overrides.providerChanges;
      }
      if (Object.hasOwn(overrides, "certificateChanges")) {
        mergedOverrides.certificateChanges = overrides.certificateChanges;
      }

      // Update with merged overrides
      const [updated] = await db
        .update(userTrackedDomains)
        .set({ notificationOverrides: mergedOverrides })
        .where(eq(userTrackedDomains.id, trackedDomainId))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Failed to update overrides - domain may have been deleted",
        });
      }

      analytics.track(
        "domain_notification_overrides_updated",
        { ...overrides },
        ctx.user.id,
      );

      return {
        id: updated.id,
        notificationOverrides: updated.notificationOverrides,
      };
    }),

  /**
   * Reset all notification overrides for a domain (inherit from global).
   */
  resetDomainNotificationOverrides: protectedProcedure
    .input(
      z.object({
        trackedDomainId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { trackedDomainId } = input;

      // Get tracked domain
      const tracked = await findTrackedDomainById(trackedDomainId);
      if (!tracked) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tracked domain not found",
        });
      }

      // Ensure user owns this tracked domain
      if (tracked.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this domain",
        });
      }

      const updated = await resetNotificationOverrides(trackedDomainId);

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Failed to reset overrides - domain may have been deleted",
        });
      }

      analytics.track("domain_notification_overrides_reset", {}, ctx.user.id);

      return {
        id: updated.id,
        notificationOverrides: updated.notificationOverrides,
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
