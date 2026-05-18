import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { analytics } from "@domainstack/analytics/server";
import { PRO_TIER_INFO } from "@domainstack/billing/polar/products";
import { polarClient } from "@domainstack/billing/polar/server";
import {
  countTrackedDomainsByStatus,
  deleteCalendarFeed,
  disableCalendarFeed,
  enableCalendarFeed,
  findTrackedDomainById,
  getActiveBillingProvider,
  getCalendarFeed,
  getLinkedAccounts,
  getOrCreateUserNotificationPreferences,
  getPushDevicesForUser,
  getUserSubscription,
  registerPushDevice,
  rotateCalendarFeedToken,
  setDomainMuted,
  setPushDeviceEnabled,
  unregisterPushDevice,
  updateUserNotificationPreferences,
} from "@domainstack/db/queries";

import { withRateLimit } from "../middleware";
import { protectedProcedure } from "../procedures";
import { createTRPCRouter } from "../trpc";

const ExpoPushTokenSchema = z
  .string()
  .min(1)
  .regex(/^(?:Exponent|Expo)PushToken\[[^\]]+\]$/, "Invalid Expo push token format");

const NotificationChannelsSchema = z.object({
  inApp: z.boolean(),
  email: z.boolean(),
  push: z.boolean(),
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
  return `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/feed.ics?token=${encodeURIComponent(token)}`;
}

export const userRouter = createTRPCRouter({
  /**
   * Get the user's linked OAuth accounts.
   * Returns only provider IDs for security (no tokens or sensitive data).
   */
  getLinkedAccounts: protectedProcedure.query(async ({ ctx }) => getLinkedAccounts(ctx.user.id)),

  /**
   * Get user's subscription data including tier, limits, and current usage.
   * Optimized to run all queries in parallel.
   */
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    // Run all independent queries in parallel for better performance
    const [subscription, counts, provider] = await Promise.all([
      getUserSubscription(ctx.user.id),
      countTrackedDomainsByStatus(ctx.user.id),
      getActiveBillingProvider(ctx.user.id),
    ]);

    return {
      plan: subscription.plan,
      planQuota: subscription.planQuota,
      // When a canceled subscription expires (null = no pending cancellation)
      endsAt: subscription.endsAt,
      // Which provider currently grants pro (null on free). The native app
      // hides in-app purchase when this is "polar" (manage on web instead).
      provider,
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
      const updated = await updateUserNotificationPreferences(ctx.user.id, input);

      analytics.track("notification_preferences_updated", { ...input }, ctx.user.id);

      return updated;
    }),

  getPushDevices: protectedProcedure.query(async ({ ctx }) => getPushDevicesForUser(ctx.user.id)),

  registerPushDevice: protectedProcedure
    .use(withRateLimit)
    .meta({ rateLimit: { requests: 10, window: "1 m" } })
    .input(
      z.object({
        expoPushToken: ExpoPushTokenSchema,
        platform: z.enum(["ios", "android"]),
        deviceName: z.string().min(1).max(120).optional(),
        deviceModel: z.string().min(1).max(120).optional(),
        deviceType: z.string().min(1).max(32).optional(),
        manufacturer: z.string().min(1).max(80).optional(),
        osName: z.string().min(1).max(40).optional(),
        osVersion: z.string().min(1).max(40).optional(),
        appVersion: z.string().min(1).max(80).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const device = await registerPushDevice({
        userId: ctx.user.id,
        expoPushToken: input.expoPushToken,
        platform: input.platform,
        deviceName: input.deviceName ?? null,
        deviceModel: input.deviceModel ?? null,
        deviceType: input.deviceType ?? null,
        manufacturer: input.manufacturer ?? null,
        osName: input.osName ?? null,
        osVersion: input.osVersion ?? null,
        appVersion: input.appVersion ?? null,
        ipAddress: ctx.ip,
      });

      analytics.track("push_device_registered", { platform: input.platform }, ctx.user.id);

      return device;
    }),

  setPushDeviceEnabled: protectedProcedure
    .use(withRateLimit)
    .meta({ rateLimit: { requests: 10, window: "1 m" } })
    .input(
      z.object({
        expoPushToken: ExpoPushTokenSchema,
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const device = await setPushDeviceEnabled(ctx.user.id, input.expoPushToken, input.enabled);

      if (!device) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Push device not found",
        });
      }

      analytics.track(
        input.enabled ? "push_device_enabled" : "push_device_disabled",
        {},
        ctx.user.id,
      );

      return device;
    }),

  unregisterPushDevice: protectedProcedure
    .use(withRateLimit)
    .meta({ rateLimit: { requests: 10, window: "1 m" } })
    .input(z.object({ expoPushToken: ExpoPushTokenSchema }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await unregisterPushDevice(ctx.user.id, input.expoPushToken);

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Push device not found",
        });
      }

      analytics.track("push_device_unregistered", {}, ctx.user.id);

      return { success: true };
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

      analytics.track(muted ? "domain_muted" : "domain_unmuted", {}, ctx.user.id);

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

  // ============================================================================
  // Polar URL Procedures (for native — web uses the better-auth Polar plugin directly)
  // ============================================================================

  /**
   * Create a Polar hosted checkout session and return its URL.
   * Native opens this in WebBrowser; the user can pick monthly/yearly on the page.
   */
  createCheckoutUrl: protectedProcedure
    .input(z.object({ successUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      if (!polarClient) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Billing is not configured on this server.",
        });
      }

      const monthlyProductId = PRO_TIER_INFO.monthly.productId;
      const yearlyProductId = PRO_TIER_INFO.yearly.productId;
      if (!monthlyProductId || !yearlyProductId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Billing is not configured on this server.",
        });
      }

      const checkout = await polarClient.checkouts.create({
        products: [monthlyProductId, yearlyProductId],
        successUrl: input.successUrl,
        externalCustomerId: ctx.user.id,
        customerEmail: ctx.user.email,
      });

      analytics.track("checkout_url_created", {}, ctx.user.id);

      return { url: checkout.url };
    }),

  /**
   * Create a Polar customer portal session and return its URL.
   * Native opens this in WebBrowser so the user can manage payment, cancel, etc.
   */
  createPortalUrl: protectedProcedure.mutation(async ({ ctx }) => {
    if (!polarClient) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Billing is not configured on this server.",
      });
    }

    const session = await polarClient.customerSessions.create({
      externalCustomerId: ctx.user.id,
    });

    analytics.track("portal_url_created", {}, ctx.user.id);

    return { url: session.customerPortalUrl };
  }),
});
