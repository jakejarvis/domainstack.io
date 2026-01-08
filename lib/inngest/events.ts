import "server-only";

import type { Section } from "@/lib/types";

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

  // Snapshots (event-driven)
  SNAPSHOT_INITIALIZE: "domain/snapshot.initialize",

  // Section revalidation (event-driven)
  SECTION_REVALIDATE: "domain/section.revalidate",
} as const;

/**
 * Event payload types
 */
export type SnapshotInitializeEvent = {
  data: {
    trackedDomainId: string;
    domainId: string;
  };
};

export type SectionRevalidateEvent = {
  data: {
    domain: string;
    section: Section;
  };
};

export type AutoVerifyPendingDomainEvent = {
  data: {
    trackedDomainId: string;
    domainName: string;
  };
};
