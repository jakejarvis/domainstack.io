/**
 * Workflow utilities barrel export.
 *
 * Centralizes exports from all workflow utility modules for convenient importing.
 *
 * @example
 * ```ts
 * import {
 *   withSwrCache,
 *   classifyFetchError,
 *   getDeduplicationKey,
 *   isConcurrencyConflict,
 * } from "@/lib/workflow";
 * ```
 */

// Re-export workflow SDK error types for convenience
export { FatalError, RetryableError } from "workflow";
// Concurrency handling
export {
  handleStepConcurrencyError,
  isConcurrencyConflict,
  isWorkflowConflictError,
  logConcurrencyConflict,
  wasAlreadyHandled,
  withConcurrencyHandling,
} from "./concurrency";
// Workflow deduplication (Redis-backed with in-memory fast path)
export type {
  DeduplicationOptions,
  DeduplicationResult,
  GetOrStartResult,
} from "./deduplication";
export {
  getDeduplicationKey,
  getOrStartWorkflow,
  getPendingRunCount,
  hasPendingRun,
  startWithDeduplication,
} from "./deduplication";
// Error classification
export type { ErrorClassification } from "./errors";
export {
  classifyDatabaseError,
  classifyFetchError,
  getErrorClassification,
  withFetchErrorHandling,
} from "./errors";
// Observability (failure tracking, metrics, etc.)
export type { TrackFailureOptions } from "./observability";
export {
  trackWorkflowFailure,
  trackWorkflowFailureAsync,
} from "./observability";
// SWR caching
export type { SwrOptions, SwrResult } from "./swr";
export { withSwrCache } from "./swr";
// Types
export type {
  PersistResult,
  RegistrationPersistResult,
  WorkflowResult,
} from "./types";
