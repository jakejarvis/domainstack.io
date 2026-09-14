import { createHash } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { start } from "workflow/api";
import { z } from "zod";

import { VERIFICATION_METHODS } from "@domainstack/constants";
import { ensureDomainRecord, findDomainByName } from "@domainstack/db/queries/domains";
import {
  archiveTrackedDomain,
  bulkArchiveTrackedDomains,
  bulkRemoveTrackedDomains,
  bulkSetTrackedDomainsMuted,
  createTrackedDomainWithLimitCheck,
  deleteTrackedDomain,
  findTrackedDomain,
  findTrackedDomainById,
  findTrackedDomainWithDomainName,
  getTrackedDomainDetails,
  getTrackedDomainsForUser,
  unarchiveTrackedDomainWithLimitCheck,
  verifyTrackedDomain,
} from "@domainstack/db/queries/tracked-domains";
import { getUserSubscription } from "@domainstack/db/queries/user-subscription";
import { sendEmail } from "@domainstack/email";
import VerificationInstructionsEmail from "@domainstack/email/templates/verification-instructions";
import { createLogger } from "@domainstack/logger";
import { getRateLimiter } from "@domainstack/redis/ratelimit";
import { autoVerifyWorkflow } from "@domainstack/workflows/auto-verify";
import { initializeSnapshotWorkflow } from "@domainstack/workflows/initialize-snapshot";

import { analytics } from "../analytics";

const logger = createLogger({ source: "routers/tracking" });

/**
 * Cross-account cap on verification-instruction emails to one address. The
 * per-user daily limit doesn't stop many accounts mailing the same person.
 */
const VERIFICATION_INSTRUCTIONS_PER_RECIPIENT = { requests: 3, window: "1 d" } as const;

import {
  verifyDomain as verifyDomainAll,
  verifyDomainByMethod,
} from "@domainstack/server/verification";
import { toRegistrableDomain } from "@domainstack/utils/domain";
import {
  buildVerificationInstructions,
  generateVerificationToken,
} from "@domainstack/utils/verification";

import { protectedProcedure } from "../procedures";
import { createTRPCRouter } from "../trpc";

const DomainInputSchema = z.object({ domain: z.string().min(1) }).transform(({ domain }) => {
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

      const items = await getTrackedDomainsForUser(ctx.user.id, {
        includeArchived,
        includeDnsRecords: false,
        includeRegistrarDetails: false,
      });

      return items;
    }),

  /**
   * Tracking status of one domain for the current user.
   * Used by the report page's Track button, which only needs this one row.
   *
   * @returns null when the domain isn't tracked by this user or is archived
   */
  getTrackingStatus: protectedProcedure.input(DomainInputSchema).query(async ({ ctx, input }) => {
    const domainRecord = await findDomainByName(input.domain);
    if (!domainRecord) {
      return null;
    }

    const tracked = await findTrackedDomain(ctx.user.id, domainRecord.id);
    if (!tracked || tracked.archivedAt) {
      return null;
    }

    return {
      id: tracked.id,
      verified: tracked.verified,
      verificationMethod: tracked.verificationMethod,
    };
  }),

  /**
   * Get full details for a tracked domain including DNS records.
   * Used for on-demand loading of provider DNS records in tooltips.
   */
  getDomainDetails: protectedProcedure
    .input(
      z.object({
        trackedDomainId: z.uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { trackedDomainId } = input;

      const domain = await getTrackedDomainDetails(ctx.user.id, trackedDomainId);

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
  addDomain: protectedProcedure.input(DomainInputSchema).mutation(async ({ ctx, input }) => {
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

      analytics.track("domain_added", { domain, resumed: true }, ctx.user.id);

      // If unverified, return the existing record so user can resume verification
      return {
        id: existing.id,
        domain,
        verificationToken: existing.verificationToken,
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
      maxDomains: sub.planQuota,
    });

    // Handle different failure cases
    if (!result.success) {
      if (result.reason === "limit_exceeded") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You have reached your domain tracking limit. Upgrade to add more domains.",
        });
      }

      // "already_exists" - race condition where another request created it first
      const raceExisting = await findTrackedDomain(ctx.user.id, domainRecord.id);
      if (raceExisting) {
        analytics.track("domain_added", { domain, resumed: true }, ctx.user.id);

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
    void start(autoVerifyWorkflow, [{ trackedDomainId: tracked.id }]).catch((err: unknown) => {
      // Log but don't fail the request - user can still manually verify
      logger.error({ err, trackedDomainId: tracked.id }, "failed to start auto-verify workflow");
    });

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
    .meta({ rateLimit: { requests: 10, window: "1 m" } })
    .input(
      z.object({
        trackedDomainId: z.uuid(),
        method: z.enum(VERIFICATION_METHODS).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { trackedDomainId, method } = input;

      // Get tracked domain with domain name in a single query
      const tracked = await findTrackedDomainWithDomainName(trackedDomainId);

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

      // Synchronous: the user is waiting on this request. Each HTTP check has
      // its own timeout (see packages/server/src/verification).
      const httpOptions = { userAgent: process.env.EXTERNAL_USER_AGENT };
      const result = method
        ? await verifyDomainByMethod(
            tracked.domainName,
            tracked.verificationToken,
            method,
            httpOptions,
          )
        : await verifyDomainAll(tracked.domainName, tracked.verificationToken, httpOptions);

      if (result.verified && result.method) {
        // Update the tracked domain as verified
        const updated = await verifyTrackedDomain(trackedDomainId, result.method);

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
        });

        analytics.track("domain_verification_succeeded", { method: result.method }, ctx.user.id);

        return { verified: true, method: result.method };
      }

      analytics.track("domain_verification_failed", { reason: "not_verified" }, ctx.user.id);

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
        trackedDomainId: z.uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { trackedDomainId } = input;

      // Get tracked domain with domain name in a single targeted query
      const tracked = await findTrackedDomainWithDomainName(trackedDomainId);

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
        trackedDomainId: z.uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { trackedDomainId } = input;

      // Get tracked domain
      const tracked = await findTrackedDomainById(trackedDomainId);

      // Return identical error for both "not found" and "wrong user"
      // to prevent enumeration attacks via error differentiation
      if (!tracked || tracked.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tracked domain not found",
        });
      }

      const deleted = await deleteTrackedDomain(trackedDomainId);

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
        trackedDomainId: z.uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { trackedDomainId } = input;

      // Get tracked domain
      const tracked = await findTrackedDomainById(trackedDomainId);

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

      const updated = await archiveTrackedDomain(trackedDomainId);

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
        trackedDomainId: z.uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { trackedDomainId } = input;

      // Get user's subscription to know their limit
      const sub = await getUserSubscription(ctx.user.id);

      // Atomic unarchive with limit check (prevents race conditions)
      const result = await unarchiveTrackedDomainWithLimitCheck(
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
        trackedDomainIds: z.array(z.uuid()).min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { trackedDomainIds } = input;

      const result = await bulkArchiveTrackedDomains(ctx.user.id, trackedDomainIds);

      const successCount = result.succeeded.length;
      const failedCount = result.notFound.length + result.notOwned.length;

      if (successCount > 0) {
        analytics.track("domains_bulk_archived", { count: successCount }, ctx.user.id);
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
        trackedDomainIds: z.array(z.uuid()).min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { trackedDomainIds } = input;

      const result = await bulkRemoveTrackedDomains(ctx.user.id, trackedDomainIds);

      const successCount = result.succeeded.length;
      const failedCount = result.notFound.length + result.notOwned.length;

      if (successCount > 0) {
        analytics.track("domains_bulk_removed", { count: successCount }, ctx.user.id);
      }

      return { successCount, failedCount };
    }),

  /**
   * Bulk mute or unmute multiple tracked domains.
   */
  bulkSetMuted: protectedProcedure
    .input(
      z.object({
        trackedDomainIds: z.array(z.uuid()).min(1).max(100),
        muted: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { trackedDomainIds, muted } = input;

      const result = await bulkSetTrackedDomainsMuted(ctx.user.id, trackedDomainIds, muted);

      const successCount = result.succeeded.length;
      const failedCount = result.notFound.length + result.notOwned.length;

      if (successCount > 0) {
        analytics.track(
          muted ? "domains_bulk_muted" : "domains_bulk_unmuted",
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
    // This is the only procedure that mails a third party chosen by the caller,
    // so the budget is a daily one. A per-minute cap still allows thousands of
    // messages a day, which makes the feature a usable spam relay.
    .meta({ rateLimit: { requests: 20, window: "1 d" } })
    .input(
      z.object({
        trackedDomainId: z.uuid(),
        recipientEmail: z.email(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { trackedDomainId, recipientEmail } = input;

      // Get the tracked domain with domain name
      const tracked = await findTrackedDomainWithDomainName(trackedDomainId);

      // Return identical error for both "not found" and "wrong user"
      // to prevent enumeration attacks via error differentiation
      if (!tracked || tracked.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tracked domain not found",
        });
      }

      // Fails open like the other limits: no Redis or a Redis error allows the send.
      const recipientLimiter =
        process.env.NODE_ENV === "development"
          ? null
          : getRateLimiter(VERIFICATION_INSTRUCTIONS_PER_RECIPIENT);
      if (recipientLimiter) {
        const recipientKey = createHash("sha256")
          .update(recipientEmail.trim().toLowerCase())
          .digest("hex")
          .slice(0, 32);
        const result = await recipientLimiter
          .limit(`tracking.sendVerificationInstructions:recipient:${recipientKey}`)
          .catch(() => null);
        if (result && !result.success) {
          const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Rate limit exceeded. Try again in ${retryAfter}s`,
            cause: { retryAfter },
          });
        }
      }

      // Build verification instructions for all methods
      const instructions = buildVerificationInstructions(
        tracked.domainName,
        tracked.verificationToken,
      );

      const senderEmail = ctx.user.email;

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL as string;

      try {
        const { error } = await sendEmail(
          {
            to: recipientEmail,
            subject: `Domain verification instructions for ${tracked.domainName}`,
            replyTo: senderEmail,
            react: VerificationInstructionsEmail({
              domain: tracked.domainName,
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
              baseUrl,
            }),
          },
          { baseUrl },
        );

        if (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to send email",
            cause: error,
          });
        }

        analytics.track(
          "verification_instructions_sent",
          { domain: tracked.domainName },
          ctx.user.id,
        );

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send email",
          cause: error,
        });
      }
    }),
});
