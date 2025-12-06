import { TRPCError } from "@trpc/server";
import z from "zod";
import { ensureDomainRecord } from "@/lib/db/repos/domains";
import {
  archiveTrackedDomain,
  countActiveTrackedDomainsForUser,
  countArchivedTrackedDomainsForUser,
  createTrackedDomainWithLimitCheck,
  deleteTrackedDomain,
  findTrackedDomain,
  findTrackedDomainById,
  findTrackedDomainWithDomainName,
  getArchivedDomainsForUser,
  getTrackedDomainsForUser,
  resetNotificationOverrides,
  unarchiveTrackedDomain,
  updateNotificationOverrides,
  verifyTrackedDomain,
} from "@/lib/db/repos/tracked-domains";
import {
  getOrCreateUserNotificationPreferences,
  updateUserNotificationPreferences,
} from "@/lib/db/repos/user-notification-preferences";
import { getUserSubscription } from "@/lib/db/repos/user-subscription";
import { toRegistrableDomain } from "@/lib/domain-server";
import {
  NotificationOverridesSchema,
  VerificationMethodSchema,
} from "@/lib/schemas";
import {
  generateVerificationToken,
  getVerificationInstructions,
  tryAllVerificationMethods,
  verifyDomainOwnership,
} from "@/server/services/verification";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

const DomainInputSchema = z
  .object({ domain: z.string().min(1) })
  .transform(({ domain }) => {
    const registrable = toRegistrableDomain(domain);
    if (!registrable) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid domain name",
      });
    }
    return { domain: registrable };
  });

/**
 * Build verification instructions for all methods.
 * Centralizes instruction generation to avoid drift if methods are added.
 */
function buildVerificationInstructions(domain: string, token: string) {
  return {
    dns_txt: getVerificationInstructions(domain, token, "dns_txt"),
    html_file: getVerificationInstructions(domain, token, "html_file"),
    meta_tag: getVerificationInstructions(domain, token, "meta_tag"),
  };
}

export const trackingRouter = createTRPCRouter({
  /**
   * Get user's limits and current usage.
   */
  getLimits: protectedProcedure.query(async ({ ctx }) => {
    const sub = await getUserSubscription(ctx.user.id);
    const activeCount = await countActiveTrackedDomainsForUser(ctx.user.id);
    const archivedCount = await countArchivedTrackedDomainsForUser(ctx.user.id);

    return {
      tier: sub.tier,
      maxDomains: sub.maxDomains,
      activeCount,
      archivedCount,
      // Only active domains count against limit
      canAddMore: activeCount < sub.maxDomains,
      // When a canceled subscription expires (null = no pending cancellation)
      subscriptionEndsAt: sub.endsAt,
    };
  }),

  /**
   * List all active (non-archived) tracked domains for the current user.
   */
  listDomains: protectedProcedure.query(async ({ ctx }) => {
    const domains = await getTrackedDomainsForUser(ctx.user.id, false);
    return domains;
  }),

  /**
   * List all archived tracked domains for the current user.
   */
  listArchivedDomains: protectedProcedure.query(async ({ ctx }) => {
    const domains = await getArchivedDomainsForUser(ctx.user.id);
    return domains;
  }),

  /**
   * Add a new domain to track (or resume tracking an unverified domain).
   * Returns the verification token and instructions.
   * If the domain is already being tracked but unverified, returns the existing record.
   */
  addDomain: protectedProcedure
    .input(DomainInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { domain } = input;

      // Ensure domain record exists in DB
      const domainRecord = await ensureDomainRecord(domain);

      // Check if already tracking this domain
      const existing = await findTrackedDomain(ctx.user.id, domainRecord.id);

      if (existing) {
        // If already verified, don't allow re-adding
        if (existing.verified) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "You are already tracking this domain",
          });
        }

        // If unverified, return the existing record so user can resume verification
        const instructions = buildVerificationInstructions(
          domain,
          existing.verificationToken,
        );

        return {
          id: existing.id,
          domain,
          verificationToken: existing.verificationToken,
          instructions,
          resumed: true, // Flag to indicate this is resuming verification
        };
      }

      // Get user's subscription to know their limit
      const sub = await getUserSubscription(ctx.user.id);

      // Generate verification token
      const verificationToken = generateVerificationToken();

      // Create tracked domain with atomic limit check (prevents race conditions)
      const result = await createTrackedDomainWithLimitCheck({
        userId: ctx.user.id,
        domainId: domainRecord.id,
        verificationToken,
        maxDomains: sub.maxDomains,
      });

      // Handle different failure cases
      if (!result.success) {
        if (result.reason === "limit_exceeded") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "You have reached your domain tracking limit. Upgrade to add more domains.",
          });
        }

        // "already_exists" - race condition where another request created it first
        const raceExisting = await findTrackedDomain(
          ctx.user.id,
          domainRecord.id,
        );
        if (raceExisting) {
          const instructions = buildVerificationInstructions(
            domain,
            raceExisting.verificationToken,
          );

          return {
            id: raceExisting.id,
            domain,
            verificationToken: raceExisting.verificationToken,
            instructions,
            resumed: true,
          };
        }

        // This shouldn't happen, but guard against it
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create tracked domain",
        });
      }

      const tracked = result.trackedDomain;

      // Get verification instructions for all methods
      const instructions = buildVerificationInstructions(
        domain,
        verificationToken,
      );

      return {
        id: tracked.id,
        domain,
        verificationToken,
        instructions,
        resumed: false,
      };
    }),

  /**
   * Verify domain ownership.
   * Can specify a method or try all methods.
   */
  verifyDomain: protectedProcedure
    .input(
      z.object({
        trackedDomainId: z.string().uuid(),
        method: VerificationMethodSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { trackedDomainId, method } = input;

      // Get tracked domain with domain name in a single query
      const tracked = await findTrackedDomainWithDomainName(trackedDomainId);
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

      // Already verified?
      if (tracked.verified) {
        return { verified: true, method: tracked.verificationMethod };
      }

      const result = method
        ? // Verify with specific method
          await verifyDomainOwnership(
            tracked.domainName,
            tracked.verificationToken,
            method,
          )
        : // Try all methods
          await tryAllVerificationMethods(
            tracked.domainName,
            tracked.verificationToken,
          );

      if (result.verified && result.method) {
        // Update the tracked domain as verified
        const updated = await verifyTrackedDomain(
          trackedDomainId,
          result.method,
        );

        if (!updated) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to verify domain - it may have been deleted",
          });
        }

        return { verified: true, method: result.method };
      }

      return {
        verified: false,
        method: null,
        error: result.error || "Verification failed. Please check your setup.",
      };
    }),

  /**
   * Get verification instructions for a tracked domain.
   */
  getVerificationInstructions: protectedProcedure
    .input(
      z.object({
        trackedDomainId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { trackedDomainId } = input;

      // Get tracked domain with domain name in a single targeted query
      const tracked = await findTrackedDomainWithDomainName(trackedDomainId);

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

      return buildVerificationInstructions(
        tracked.domainName,
        tracked.verificationToken,
      );
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
   */
  updateGlobalNotificationPreferences: protectedProcedure
    .input(NotificationOverridesSchema)
    .mutation(async ({ ctx, input }) => {
      const updated = await updateUserNotificationPreferences(
        ctx.user.id,
        input,
      );
      return updated;
    }),

  /**
   * Update notification overrides for a specific tracked domain.
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

      const updated = await updateNotificationOverrides(
        trackedDomainId,
        overrides,
      );

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Failed to update overrides - domain may have been deleted",
        });
      }

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

      return {
        id: updated.id,
        notificationOverrides: updated.notificationOverrides,
      };
    }),

  /**
   * Remove a tracked domain.
   */
  removeDomain: protectedProcedure
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

      const deleted = await deleteTrackedDomain(trackedDomainId);

      if (!deleted) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to remove domain",
        });
      }

      return { success: true };
    }),

  /**
   * Archive a tracked domain.
   * Archived domains don't count against the user's limit.
   */
  archiveDomain: protectedProcedure
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

      // Check if already archived
      if (tracked.archivedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Domain is already archived",
        });
      }

      const updated = await archiveTrackedDomain(trackedDomainId);

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to archive domain",
        });
      }

      return { success: true, archivedAt: updated.archivedAt };
    }),

  /**
   * Unarchive (reactivate) a tracked domain.
   * Checks that user has capacity before unarchiving.
   */
  unarchiveDomain: protectedProcedure
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

      // Check if actually archived
      if (!tracked.archivedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Domain is not archived",
        });
      }

      // Check user has capacity to unarchive
      const sub = await getUserSubscription(ctx.user.id);
      const activeCount = await countActiveTrackedDomainsForUser(ctx.user.id);

      if (activeCount >= sub.maxDomains) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "You have reached your domain tracking limit. Upgrade to Pro or archive other domains first.",
        });
      }

      const updated = await unarchiveTrackedDomain(trackedDomainId);

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to unarchive domain",
        });
      }

      return { success: true };
    }),

  /**
   * Bulk archive multiple tracked domains.
   * Performs all operations in parallel for efficiency.
   */
  bulkArchiveDomains: protectedProcedure
    .input(
      z.object({
        trackedDomainIds: z.array(z.string().uuid()).min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { trackedDomainIds } = input;

      const results = await Promise.allSettled(
        trackedDomainIds.map(async (trackedDomainId) => {
          // Get tracked domain
          const tracked = await findTrackedDomainById(trackedDomainId);
          if (!tracked) {
            throw new Error("Tracked domain not found");
          }

          // Ensure user owns this tracked domain
          if (tracked.userId !== ctx.user.id) {
            throw new Error("You do not have access to this domain");
          }

          // Skip if already archived
          if (tracked.archivedAt) {
            return { id: trackedDomainId, alreadyArchived: true };
          }

          const updated = await archiveTrackedDomain(trackedDomainId);
          if (!updated) {
            throw new Error("Failed to archive domain");
          }

          return { id: trackedDomainId, archivedAt: updated.archivedAt };
        }),
      );

      const successCount = results.filter(
        (r) => r.status === "fulfilled",
      ).length;
      const failedCount = results.filter((r) => r.status === "rejected").length;

      return { successCount, failedCount };
    }),

  /**
   * Bulk remove multiple tracked domains.
   * Performs all operations in parallel for efficiency.
   */
  bulkRemoveDomains: protectedProcedure
    .input(
      z.object({
        trackedDomainIds: z.array(z.string().uuid()).min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { trackedDomainIds } = input;

      const results = await Promise.allSettled(
        trackedDomainIds.map(async (trackedDomainId) => {
          // Get tracked domain
          const tracked = await findTrackedDomainById(trackedDomainId);
          if (!tracked) {
            throw new Error("Tracked domain not found");
          }

          // Ensure user owns this tracked domain
          if (tracked.userId !== ctx.user.id) {
            throw new Error("You do not have access to this domain");
          }

          const deleted = await deleteTrackedDomain(trackedDomainId);
          if (!deleted) {
            throw new Error("Failed to remove domain");
          }

          return { id: trackedDomainId };
        }),
      );

      const successCount = results.filter(
        (r) => r.status === "fulfilled",
      ).length;
      const failedCount = results.filter((r) => r.status === "rejected").length;

      return { successCount, failedCount };
    }),
});
