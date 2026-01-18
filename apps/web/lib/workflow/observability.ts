/**
 * Workflow observability utilities.
 *
 * This module provides functions for tracking workflow events for
 * observability, alerting, and debugging. Currently supports:
 * - Workflow failure tracking (fatal errors, retry exhaustion)
 *
 * Future additions could include:
 * - Workflow success metrics
 * - Step duration tracking
 * - Retry rate monitoring
 * - Data staleness alerts
 */
import "server-only";

import type { Section } from "@/lib/constants/sections";
import { inngest } from "@/lib/inngest/client";
import {
  INNGEST_EVENTS,
  type WorkflowFailedPayload,
} from "@/lib/inngest/events";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "workflow/observability" });

/**
 * Options for tracking a workflow failure.
 */
export interface TrackFailureOptions {
  /** The workflow that failed */
  workflow: string;
  /** The domain being processed (if applicable) */
  domain?: string;
  /** The section being processed (if applicable) */
  section?: Section;
  /** The error that caused the failure */
  error: Error | string;
  /** Error classification */
  classification: "fatal" | "retries_exhausted";
  /** Additional context for debugging */
  context?: Record<string, unknown>;
}

/**
 * Track a workflow failure for observability and alerting.
 *
 * This function:
 * 1. Logs the failure with structured context
 * 2. Sends an Inngest event for potential alerting/aggregation
 *
 * Use this when:
 * - A workflow encounters a FatalError (should not retry)
 * - A workflow exhausts all retries for a RetryableError
 *
 * @example
 * ```ts
 * // In a workflow error handler
 * await trackWorkflowFailure({
 *   workflow: "registration",
 *   domain: "example.com",
 *   error: err,
 *   classification: "fatal",
 *   context: { rdapServer: "rdap.example.com" },
 * });
 * ```
 */
export async function trackWorkflowFailure(
  options: TrackFailureOptions,
): Promise<void> {
  const { workflow, domain, section, error, classification, context } = options;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : "Error";

  // Log with full context
  logger.error(
    {
      workflow,
      domain,
      section,
      classification,
      errorName,
      context,
    },
    `workflow failed: ${errorMessage}`,
  );

  // Send Inngest event for potential alerting/aggregation
  const payload: WorkflowFailedPayload = {
    workflow,
    domain,
    section,
    error: errorMessage,
    classification,
    context,
    failedAt: new Date().toISOString(),
  };

  try {
    await inngest.send({
      name: INNGEST_EVENTS.WORKFLOW_FAILED,
      data: payload,
    });
  } catch (sendError) {
    // Don't fail the operation if we can't send the event
    logger.warn(
      { err: sendError, workflow, domain },
      "failed to send workflow failure event",
    );
  }
}

/**
 * Fire-and-forget version of trackWorkflowFailure.
 * Use this in contexts where you can't await (e.g., inside error handlers).
 */
export function trackWorkflowFailureAsync(options: TrackFailureOptions): void {
  void trackWorkflowFailure(options).catch(() => {
    // Swallow - we already log in trackWorkflowFailure
  });
}
