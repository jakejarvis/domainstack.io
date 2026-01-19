import "server-only";

/**
 * Centralized event type definitions for Inngest functions.
 * Provides type-safe event names and payload types.
 *
 * Note: Most worker events have been migrated to Vercel Workflows.
 * These remaining events are for:
 * - Event-driven triggers (domain added, domain verified)
 * - Section revalidation requests
 *
 * @see https://www.inngest.com/docs/reference/events/send
 */
export const INNGEST_EVENTS = {
  // Verification (event-driven)
  AUTO_VERIFY_PENDING_DOMAIN: "domain/verification.new",

  // Section revalidation (event-driven)
  SECTION_REVALIDATE: "domain/section.revalidate",
} as const;
