import "server-only";

/**
 * Centralized event type definitions for Inngest functions.
 * Provides type-safe event names and payload types.
 *
 * Note: Most worker events have been migrated to Vercel Workflows.
 * These remaining events are for:
 * - Section revalidation requests
 *
 * @see https://www.inngest.com/docs/reference/events/send
 */
export const INNGEST_EVENTS = {
  // Section revalidation (event-driven)
  SECTION_REVALIDATE: "domain/section.revalidate",
} as const;
