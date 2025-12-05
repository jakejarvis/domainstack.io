import { TRPCError } from "@trpc/server";
import z from "zod";
import { ensureDomainRecord } from "@/lib/db/repos/domains";
import {
  archiveTrackedDomain,
  countActiveTrackedDomainsForUser,
  countArchivedTrackedDomainsForUser,
  countTrackedDomainsForUser,
  createTrackedDomain,
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
  canUserAddDomain,
  getOrCreateUserLimits,
} from "@/lib/db/repos/user-limits";
import {
  getOrCreateUserNotificationPreferences,
  updateUserNotificationPreferences,
} from "@/lib/db/repos/user-notification-preferences";
import { toRegistrableDomain } from "@/lib/domain-server";
import type { NotificationOverrides } from "@/lib/schemas";
import {
  generateVerificationToken,
  getVerificationInstructions,
  tryAllVerificationMethods,
  verifyDomainOwnership,
} from "@/server/services/verification";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

// Schema for notification overrides
const NotificationOverridesSchema = z.object({
  domainExpiry: z.boolean().optional(),
  certificateExpiry: z.boolean().optional(),
  verificationStatus: z.boolean().optional(),
}) satisfies z.ZodType<NotificationOverrides>;

const VerificationMethodSchema = z.enum(["dns_txt", "html_file", "meta_tag"]);

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

export const trackingRouter = createTRPCRouter({
  /**
   * Get user's limits and current usage.
   */
  getLimits: protectedProcedure.query(async ({ ctx }) => {
    const limits = await getOrCreateUserLimits(ctx.user.id);
    const activeCount = await countActiveTrackedDomainsForUser(ctx.user.id);
    const archivedCount = await countArchivedTrackedDomainsForUser(ctx.user.id);

    return {
      tier: limits.tier,
      maxDomains: limits.maxDomains,
      activeCount,
      archivedCount,
      // Only active domains count against limit
      canAddMore: activeCount < limits.maxDomains,
      // When a canceled subscription expires (null = no pending cancellation)
      subscriptionEndsAt: limits.subscriptionEndsAt,
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
        const instructions = {
          dns_txt: getVerificationInstructions(
            domain,
            existing.verificationToken,
            "dns_txt",
          ),
          html_file: getVerificationInstructions(
            domain,
            existing.verificationToken,
            "html_file",
          ),
          meta_tag: getVerificationInstructions(
            domain,
            existing.verificationToken,
            "meta_tag",
          ),
        };

        return {
          id: existing.id,
          domain,
          verificationToken: existing.verificationToken,
          instructions,
          resumed: true, // Flag to indicate this is resuming verification
        };
      }

      // Check limits (only for new domains, not resumed ones)
      const currentCount = await countTrackedDomainsForUser(ctx.user.id);
      const canAdd = await canUserAddDomain(ctx.user.id, currentCount);

      if (!canAdd) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "You have reached your domain tracking limit. Upgrade to add more domains.",
        });
      }

      // Generate verification token
      const verificationToken = generateVerificationToken();

      // Create tracked domain record
      const tracked = await createTrackedDomain({
        userId: ctx.user.id,
        domainId: domainRecord.id,
        verificationToken,
      });

      // Handle race condition: if another request created it first, fetch and resume
      if (!tracked) {
        const raceExisting = await findTrackedDomain(
          ctx.user.id,
          domainRecord.id,
        );
        if (raceExisting) {
          const instructions = {
            dns_txt: getVerificationInstructions(
              domain,
              raceExisting.verificationToken,
              "dns_txt",
            ),
            html_file: getVerificationInstructions(
              domain,
              raceExisting.verificationToken,
              "html_file",
            ),
            meta_tag: getVerificationInstructions(
              domain,
              raceExisting.verificationToken,
              "meta_tag",
            ),
          };
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

      // Get verification instructions for all methods
      const instructions = {
        dns_txt: getVerificationInstructions(
          domain,
          verificationToken,
          "dns_txt",
        ),
        html_file: getVerificationInstructions(
          domain,
          verificationToken,
          "html_file",
        ),
        meta_tag: getVerificationInstructions(
          domain,
          verificationToken,
          "meta_tag",
        ),
      };

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

      return {
        dns_txt: getVerificationInstructions(
          tracked.domainName,
          tracked.verificationToken,
          "dns_txt",
        ),
        html_file: getVerificationInstructions(
          tracked.domainName,
          tracked.verificationToken,
          "html_file",
        ),
        meta_tag: getVerificationInstructions(
          tracked.domainName,
          tracked.verificationToken,
          "meta_tag",
        ),
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

      await deleteTrackedDomain(trackedDomainId);

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
      const limits = await getOrCreateUserLimits(ctx.user.id);
      const activeCount = await countActiveTrackedDomainsForUser(ctx.user.id);

      if (activeCount >= limits.maxDomains) {
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
});
