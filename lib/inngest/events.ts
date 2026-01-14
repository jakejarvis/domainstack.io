import "server-only";

import type { Section } from "@/lib/constants/sections";

/**
 * Centralized event type definitions for Inngest functions.
 * Provides type-safe event names and payload types.
 *
 * Note: Most worker events have been migrated to Vercel Workflows.
 * These remaining events are for:
 * - Event-driven triggers (domain added, domain verified)
 * - Section revalidation requests
 * - Observability events (workflow failures)
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

  // Observability (workflow failures)
  WORKFLOW_FAILED: "system/workflow.failed",
} as const;

/**
 * Payload for WORKFLOW_FAILED event.
 * Sent when a workflow permanently fails (retries exhausted or fatal error).
 */
export interface WorkflowFailedPayload {
  /** The workflow that failed (e.g., "registration", "dns", "section-revalidate") */
  workflow: string;
  /** The domain being processed (if applicable) */
  domain?: string;
  /** The section being processed (if applicable) */
  section?: Section;
  /** Error message */
  error: string;
  /** Error classification: "fatal" or "retries_exhausted" */
  classification: "fatal" | "retries_exhausted";
  /** Additional context for debugging */
  context?: Record<string, unknown>;
  /** Timestamp when the failure occurred */
  failedAt: string;
}
