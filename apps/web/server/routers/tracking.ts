import { VERIFICATION_METHODS } from "@domainstack/constants";
import { TRPCError } from "@trpc/server";
import { start } from "workflow/api";
import z from "zod";
import VerificationInstructionsEmail from "@/emails/verification-instructions";
import { analytics } from "@/lib/analytics/server";
import {
  domainsRepo,
  trackedDomainsRepo,
  userSubscriptionRepo,
} from "@/lib/db/repos";
import { createLogger } from "@/lib/logger/server";
import { autoVerifyWorkflow } from "@/workflows/auto-verify";
import { initializeSnapshotWorkflow } from "@/workflows/initialize-snapshot";

const logger = createLogger({ source: "routers/tracking" });

import { toRegistrableDomain } from "@/lib/normalize-domain";
import { sendEmail } from "@/lib/resend";
import { buildVerificationInstructions } from "@/lib/verification-instructions";
import {
  createTRPCRouter,
  protectedProcedure,
  withRateLimit,
} from "@/trpc/init";
import {
  generateVerificationToken,
  verificationWorkflow,
} from "@/workflows/verification";

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
   * List tracked domains for the current user.
   *
   * @param includeArchived - Whether to include archived domains (defaults to false)
   * @returns Array of tracked domains
   */
  listDomains: protectedProcedure
    .input(
      z
        .object({
          includeArchived: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const includeArchived = input?.includeArchived ?? false;

      const items = await trackedDomainsRepo.getTrackedDomainsForUser(
        ctx.user.id,
        {
          includeArchived,
          includeDnsRecords: false,
          includeRegistrarDetails: false,
        },
      );

      return items;
    }),

  /**
   * Get full details for a tracked domain including DNS records.
   * Used for on-demand loading of provider DNS records in tooltips.
   */
  getDomainDetails: protectedProcedure
    .input(
      z.object({
        trackedDomainId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { trackedDomainId } = input;

      const domain = await trackedDomainsRepo.getTrackedDomainDetails(
        ctx.user.id,
        trackedDomainId,
      );

      // Return identical error for both "not found" and "wrong user"
      // to prevent enumeration attacks via error differentiation
      if (!domain) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tracked domain not found",
        });
      }

      return domain;
    }),

  /**
   * Add a new domain to track (or resume tracking an unverified domain).
   * Returns the verification token (instructions are generated client-side).
   * If the domain is already being tracked but unverified, returns the existing record.
   */
  addDomain: protectedProcedure
    .input(DomainInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { domain } = input;

      // Ensure domain record exists in DB
      const domainRecord = await domainsRepo.ensureDomainRecord(domain);

      // Check if already tracking this domain
      const existing = await trackedDomainsRepo.findTrackedDomain(
        ctx.user.id,
        domainRecord.id,
      );

      if (existing) {
        // If already verified, don't allow re-adding
        if (existing.verified) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "You are already tracking this domain",
          });
        }

        // If unverified, return the existing record so user can resume verification
        return {
          id: existing.id,
          domain,
          verificationToken: existing.verificationToken,
          resumed: true, // Flag to indicate this is resuming verification
        };
      }

      // Get user's subscription to know their limit
      const sub = await userSubscriptionRepo.getUserSubscription(ctx.user.id);

      // Generate verification token
      const verificationToken = generateVerificationToken();

      // Create tracked domain with atomic limit check (prevents race conditions)
      const result = await trackedDomainsRepo.createTrackedDomainWithLimitCheck(
        {
          userId: ctx.user.id,
          domainId: domainRecord.id,
          verificationToken,
          maxDomains: sub.planQuota,
        },
      );

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
        const raceExisting = await trackedDomainsRepo.findTrackedDomain(
          ctx.user.id,
          domainRecord.id,
        );
        if (raceExisting) {
          return {
            id: raceExisting.id,
            domain,
            verificationToken: raceExisting.verificationToken,
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

      // Trigger auto-verification workflow in the background
      // The workflow handles a 30-day retry schedule with increasing delays.
      void start(autoVerifyWorkflow, [{ trackedDomainId: tracked.id }]).catch(
        (err: unknown) => {
          // Log but don't fail the request - user can still manually verify
          logger.error(
            { err, trackedDomainId: tracked.id },
            "failed to start auto-verify workflow",
          );
        },
      );

      analytics.track("domain_added", { domain, resumed: false }, ctx.user.id);

      return {
        id: tracked.id,
        domain,
        verificationToken,
        resumed: false,
      };
    }),

  /**
   * Verify domain ownership.
   * Can specify a method or try all methods.
   */
  verifyDomain: protectedProcedure
    .use(withRateLimit)
    .meta({ rateLimit: { requests: 10, window: "1 m" } })
    .input(
      z.object({
        trackedDomainId: z.string().uuid(),
        method: z.enum(VERIFICATION_METHODS).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { trackedDomainId, method } = input;

      // Get tracked domain with domain name in a single query
      const tracked =
        await trackedDomainsRepo.findTrackedDomainWithDomainName(
          trackedDomainId,
        );

      // Return identical error for both "not found" and "wrong user"
      // to prevent enumeration attacks via error differentiation
      if (!tracked || tracked.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tracked domain not found",
        });
      }

      // Already verified?
      if (tracked.verified) {
        return { verified: true, method: tracked.verificationMethod };
      }

      // Run verification workflow and wait for result
      const run = await start(verificationWorkflow, [
        {
          domain: tracked.domainName,
          token: tracked.verificationToken,
          method: method ?? undefined,
        },
      ]);
      const result = await run.returnValue;

      if (result.success && result.data.verified && result.data.method) {
        // Update the tracked domain as verified
        const updated = await trackedDomainsRepo.verifyTrackedDomain(
          trackedDomainId,
          result.data.method,
        );

        if (!updated) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to verify domain - it may have been deleted",
          });
        }

        // After verification, create baseline snapshot for change detection
        void start(initializeSnapshotWorkflow, [
          {
            trackedDomainId: updated.id,
            domainId: updated.domainId,
          },
        ]).catch((err) => {
          const errorMessage = err instanceof Error ? err.message : String(err);
          logger.error(
            {
              workflow: "initialize-snapshot-trigger",
              trackedDomainId: updated.id,
              domainId: updated.domainId,
              trigger: "manual_verification",
            },
            `workflow failed: ${errorMessage}`,
          );
          analytics.track(
            "workflow_failed",
            {
              workflow: "initialize-snapshot-trigger",
              classification: "fatal",
              error: errorMessage,
              trackedDomainId: updated.id,
              domainId: updated.domainId,
              trigger: "manual_verification",
            },
            "system",
          );
        });

        return { verified: true, method: result.data.method };
      }

      return {
        verified: false,
        method: null,
      };
    }),

  /**
   * Get verification data needed to display verification instructions.
   * (Instructions are generated on the client from the returned token.)
   */
  getVerificationData: protectedProcedure
    .input(
      z.object({
        trackedDomainId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { trackedDomainId } = input;

      // Get tracked domain with domain name in a single targeted query
      const tracked =
        await trackedDomainsRepo.findTrackedDomainWithDomainName(
          trackedDomainId,
        );

      // Return identical error for both "not found" and "wrong user"
      // to prevent enumeration attacks via error differentiation
      if (!tracked || tracked.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tracked domain not found",
        });
      }

      return {
        domain: tracked.domainName,
        verificationToken: tracked.verificationToken,
        verificationMethod: tracked.verificationMethod,
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
      const tracked =
        await trackedDomainsRepo.findTrackedDomainById(trackedDomainId);

      // Return identical error for both "not found" and "wrong user"
      // to prevent enumeration attacks via error differentiation
      if (!tracked || tracked.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tracked domain not found",
        });
      }

      const deleted =
        await trackedDomainsRepo.deleteTrackedDomain(trackedDomainId);

      if (!deleted) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to remove domain",
        });
      }

      analytics.track("domain_removed", {}, ctx.user.id);

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
      const tracked =
        await trackedDomainsRepo.findTrackedDomainById(trackedDomainId);

      // Return identical error for both "not found" and "wrong user"
      // to prevent enumeration attacks via error differentiation
      if (!tracked || tracked.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tracked domain not found",
        });
      }

      // Check if already archived
      if (tracked.archivedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Domain is already archived",
        });
      }

      const updated =
        await trackedDomainsRepo.archiveTrackedDomain(trackedDomainId);

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to archive domain",
        });
      }

      analytics.track("domain_archived", {}, ctx.user.id);

      return { success: true, archivedAt: updated.archivedAt };
    }),

  /**
   * Unarchive (reactivate) a tracked domain.
   * Uses atomic limit checking to prevent race conditions.
   */
  unarchiveDomain: protectedProcedure
    .input(
      z.object({
        trackedDomainId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { trackedDomainId } = input;

      // Get user's subscription to know their limit
      const sub = await userSubscriptionRepo.getUserSubscription(ctx.user.id);

      // Atomic unarchive with limit check (prevents race conditions)
      const result =
        await trackedDomainsRepo.unarchiveTrackedDomainWithLimitCheck(
          trackedDomainId,
          ctx.user.id,
          sub.planQuota,
        );

      if (!result.success) {
        switch (result.reason) {
          // Return identical error for both "not found" and "wrong user"
          // to prevent enumeration attacks via error differentiation
          case "not_found":
          case "wrong_user":
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Tracked domain not found",
            });
          case "not_archived":
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Domain is not archived",
            });
          case "limit_exceeded":
            throw new TRPCError({
              code: "FORBIDDEN",
              message:
                "You have reached your domain tracking limit. Upgrade to Pro or archive other domains first.",
            });
        }
      }

      analytics.track("domain_unarchived", {}, ctx.user.id);

      return { success: true };
    }),

  /**
   * Bulk archive multiple tracked domains.
   * Uses batch operations for efficiency (2 queries instead of N+1).
   */
  bulkArchiveDomains: protectedProcedure
    .input(
      z.object({
        trackedDomainIds: z.array(z.string().uuid()).min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { trackedDomainIds } = input;

      const result = await trackedDomainsRepo.bulkArchiveTrackedDomains(
        ctx.user.id,
        trackedDomainIds,
      );

      const successCount = result.succeeded.length;
      const failedCount = result.notFound.length + result.notOwned.length;

      if (successCount > 0) {
        analytics.track(
          "domains_bulk_archived",
          { count: successCount },
          ctx.user.id,
        );
      }

      return { successCount, failedCount };
    }),

  /**
   * Bulk remove multiple tracked domains.
   * Uses batch operations for efficiency (2 queries instead of N+1).
   */
  bulkRemoveDomains: protectedProcedure
    .input(
      z.object({
        trackedDomainIds: z.array(z.string().uuid()).min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { trackedDomainIds } = input;

      const result = await trackedDomainsRepo.bulkRemoveTrackedDomains(
        ctx.user.id,
        trackedDomainIds,
      );

      const successCount = result.succeeded.length;
      const failedCount = result.notFound.length + result.notOwned.length;

      if (successCount > 0) {
        analytics.track(
          "domains_bulk_removed",
          { count: successCount },
          ctx.user.id,
        );
      }

      return { successCount, failedCount };
    }),

  /**
   * Send verification instructions to an email address (e.g., domain admin).
   * Allows users to share verification instructions with someone who manages their domain.
   */
  sendVerificationInstructions: protectedProcedure
    .use(withRateLimit)
    .meta({ rateLimit: { requests: 5, window: "1 m" } })
    .input(
      z.object({
        trackedDomainId: z.string().uuid(),
        recipientEmail: z.string().email(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { trackedDomainId, recipientEmail } = input;

      // Get the tracked domain with domain name
      const tracked =
        await trackedDomainsRepo.findTrackedDomainWithDomainName(
          trackedDomainId,
        );

      // Return identical error for both "not found" and "wrong user"
      // to prevent enumeration attacks via error differentiation
      if (!tracked || tracked.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tracked domain not found",
        });
      }

      // Build verification instructions for all methods
      const instructions = buildVerificationInstructions(
        tracked.domainName,
        tracked.verificationToken,
      );

      // Get sender info
      const senderName = ctx.user.name || "A Domainstack user";
      const senderEmail = ctx.user.email;

      try {
        const { error } = await sendEmail({
          to: recipientEmail,
          subject: `Domain verification instructions for ${tracked.domainName}`,
          react: VerificationInstructionsEmail({
            domain: tracked.domainName,
            senderName,
            senderEmail,
            dnsHostname: instructions.dns_txt.hostname,
            dnsRecordType: instructions.dns_txt.recordType,
            dnsValue: instructions.dns_txt.value,
            dnsTTL: instructions.dns_txt.suggestedTTL,
            dnsTTLLabel: instructions.dns_txt.suggestedTTLLabel,
            htmlFilePath: instructions.html_file.fullPath,
            htmlFileName: instructions.html_file.filename,
            htmlFileContent: instructions.html_file.fileContent,
            metaTag: instructions.meta_tag.metaTag,
          }),
        });

        if (error) {
          logger.error({ err: error, trackedDomainId });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to send email",
          });
        }

        analytics.track(
          "verification_instructions_sent",
          { domain: tracked.domainName },
          ctx.user.id,
        );

        return { success: true };
      } catch (error) {
        logger.error({ err: error, trackedDomainId });

        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send email",
        });
      }
    }),
});
