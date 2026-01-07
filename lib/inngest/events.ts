import "server-only";

import type { Section } from "@/lib/types";

/**
 * Centralized event type definitions for Inngest functions.
 * Provides type-safe event names and payload types.
 *
 * Naming convention follows Inngest's recommendation: prefix/noun.verb
 * @see https://www.inngest.com/docs/reference/events/send
 */
export const INNGEST_EVENTS = {
  // Monitoring
  MONITOR_CHANGES: "domain/check.all",

  // Expiry checks
  CHECK_DOMAIN_EXPIRY: "domain/check.registration",
  CHECK_CERTIFICATE_EXPIRY: "domain/check.certificates",

  // Verification
  VERIFY_PENDING_CRON: "domain/verification.pending",
  AUTO_VERIFY_PENDING_DOMAIN: "domain/verification.new",
  REVERIFY_OWNERSHIP: "domain/verification.recheck",

  // Snapshots
  SNAPSHOT_INITIALIZE: "domain/snapshot.initialize",

  // Section revalidation
  SECTION_REVALIDATE: "domain/section.revalidate",

  // User
  CHECK_SUBSCRIPTION_EXPIRY: "user/subscription.expiring",
} as const;

/**
 * Event payload types
 */
export type TrackedDomainEvent = {
  data: { trackedDomainId: string };
};

export type SubscriptionExpiryEvent = {
  data: { userId: string };
};

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
