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
// Workflow deduplication
export type { DeduplicationOptions } from "./deduplication";
export {
  getDeduplicationKey,
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
// SWR caching
export type { SwrOptions, SwrResult } from "./swr";
export { withSwrCache } from "./swr";
// Types
export type {
  PersistResult,
  RegistrationPersistResult,
  WorkflowResult,
} from "./types";
