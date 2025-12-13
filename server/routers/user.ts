import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import z from "zod";
import { analytics } from "@/lib/analytics/server";
import { db } from "@/lib/db/client";
import {
  findTrackedDomainById,
  resetNotificationOverrides,
} from "@/lib/db/repos/tracked-domains";
import {
  getOrCreateUserNotificationPreferences,
  updateUserNotificationPreferences,
} from "@/lib/db/repos/user-notification-preferences";
import { accounts, userTrackedDomains } from "@/lib/db/schema";
import {
  NotificationOverridesSchema,
  UpdateNotificationPreferencesSchema,
} from "@/lib/schemas";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

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
      if (Object.hasOwn(overrides, "verificationStatus")) {
        mergedOverrides.verificationStatus = overrides.verificationStatus;
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
});
