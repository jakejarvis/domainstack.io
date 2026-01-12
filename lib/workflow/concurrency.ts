import "server-only";
import { WorkflowAPIError } from "workflow/internal/errors";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "workflow-concurrency" });

/**
 * HTTP status code for conflict errors (concurrent step execution)
 */
const CONFLICT_STATUS = 409;

/**
 * Error messages that indicate a step result was already set by another worker
 */
const STEP_ALREADY_SET_PATTERNS = [
  "error already exists",
  "result already exists",
  "value already exists",
  "already set",
  "Cannot set",
] as const;

/**
 * Check if an error is a concurrency conflict from the Workflow SDK.
 *
 * This happens when multiple workers execute the same step concurrently
 * (due to at-least-once delivery) and one worker tries to set the step
 * result after another worker has already done so.
 *
 * @param error - The error to check
 * @returns true if this is a 409 concurrency conflict
 *
 * @example
 * ```ts
 * try {
 *   await persistData(domain, data);
 * } catch (err) {
 *   if (isConcurrencyConflict(err)) {
 *     // Another worker already handled this step - safe to ignore
 *     return;
 *   }
 *   throw err; // Re-throw other errors
 * }
 * ```
 */
export function isConcurrencyConflict(error: unknown): boolean {
  if (!WorkflowAPIError.is(error)) {
    return false;
  }

  // Check for 409 status
  if (error.status !== CONFLICT_STATUS) {
    return false;
  }

  // Most known concurrency conflicts are 409s from the workflow API when a step result
  // is already set by another worker. Messages can vary across SDK/server versions,
  // so treat any 409 WorkflowAPIError as a concurrency conflict.
  const message = error.message.toLowerCase();
  const matchesKnownPattern = STEP_ALREADY_SET_PATTERNS.some((pattern) =>
    message.includes(pattern.toLowerCase()),
  );

  if (!matchesKnownPattern) {
    logger.debug(
      { message: error.message },
      "treating 409 WorkflowAPIError as concurrency conflict (message did not match known patterns)",
    );
  }

  return true;
}

/**
 * Log level for concurrency conflicts.
 *
 * These are expected in at-least-once delivery systems and should be
 * logged at debug level to avoid noise in production logs.
 */
export function logConcurrencyConflict(
  context: Record<string, unknown>,
  message = "step already handled by another worker",
): void {
  logger.debug(context, message);
}

/**
 * Handle errors from workflow step execution with proper concurrency handling.
 *
 * If the error is a concurrency conflict (409), it logs at debug level and
 * returns a marker indicating the step was already handled. Otherwise,
 * it re-throws the error for the workflow to handle.
 *
 * @param error - The error caught during step execution
 * @param context - Additional context for logging
 * @returns "already_handled" if this was a concurrency conflict
 * @throws The original error if it's not a concurrency conflict
 *
 * @example
 * ```ts
 * async function persistDataStep(domain: string, data: Data): Promise<void | "already_handled"> {
 *   "use step";
 *   try {
 *     await persistData(domain, data);
 *   } catch (err) {
 *     return handleStepConcurrencyError(err, { domain });
 *   }
 * }
 * ```
 */
export function handleStepConcurrencyError(
  error: unknown,
  context: Record<string, unknown> = {},
): "already_handled" {
  if (isConcurrencyConflict(error)) {
    logConcurrencyConflict(context);
    return "already_handled";
  }
  throw error;
}

/**
 * Type guard to check if a step result indicates it was already handled
 * by another concurrent worker.
 */
export function wasAlreadyHandled<T>(
  result: T | "already_handled",
): result is "already_handled" {
  return result === "already_handled";
}

/**
 * Wrap a workflow execution to handle concurrency conflicts gracefully.
 *
 * When the workflow SDK encounters a 409 conflict (another worker already
 * handled the step), this wrapper logs at debug level instead of throwing,
 * reducing noise in production logs.
 *
 * @param operation - The workflow operation to execute (typically `run.returnValue`)
 * @param context - Additional context for logging
 * @returns The workflow result, or undefined if it was a concurrency conflict
 *
 * @example
 * ```ts
 * const run = await start(myWorkflow, [input]);
 * const result = await withConcurrencyHandling(
 *   run.returnValue,
 *   { domain: "example.com", workflow: "dns" }
 * );
 *
 * if (result === undefined) {
 *   // Another worker already handled this - workflow was not lost
 *   return;
 * }
 * ```
 */
export async function withConcurrencyHandling<T>(
  operation: Promise<T>,
  context: Record<string, unknown> = {},
): Promise<T | undefined> {
  try {
    return await operation;
  } catch (err) {
    if (isConcurrencyConflict(err)) {
      logConcurrencyConflict(
        context,
        "workflow step handled by another worker",
      );
      return undefined;
    }
    throw err;
  }
}

/**
 * Check if an error is any type of workflow concurrency or conflict error
 * that should be treated as a "soft failure" (another worker succeeded).
 *
 * This is useful for retry logic where you want to stop retrying if
 * another worker already completed the work.
 */
export function isWorkflowConflictError(error: unknown): boolean {
  return isConcurrencyConflict(error);
}
