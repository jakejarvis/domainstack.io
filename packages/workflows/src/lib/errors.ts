import { FatalError, RetryableError } from "workflow";

/**
 * Classify a database-related error into a workflow error.
 *
 * Database operations can fail transiently (connection timeouts, deadlocks,
 * temporary unavailability) and should be retried. This helper ensures
 * database errors are properly classified as retryable unless they're
 * clearly permanent (constraint violations, etc.).
 *
 * @param err - The error to classify
 * @param options - Classification options
 * @returns RetryableError or FatalError based on error classification
 *
 * @example
 * ```ts
 * async function persistDataStep(data: Data): Promise<void> {
 *   "use step";
 *   try {
 *     await db.insert(table).values(data);
 *   } catch (err) {
 *     throw classifyDatabaseError(err, { context: 'persisting data' });
 *   }
 * }
 * ```
 */
export function classifyDatabaseError(
  err: unknown,
  options: {
    /** Context string for error messages */
    context?: string;
    /** Delay before retry (default: "2s") */
    retryAfter?: string;
  } = {},
): RetryableError | FatalError {
  const { context = "database operation", retryAfter = "2s" } = options;

  // Preserve existing workflow errors
  if (err instanceof FatalError || err instanceof RetryableError) {
    return err;
  }

  if (err instanceof Error) {
    const message = err.message.toLowerCase();

    // Connection/timeout errors are retryable
    if (
      message.includes("timeout") ||
      message.includes("timed out") ||
      message.includes("connection") ||
      message.includes("econnrefused") ||
      message.includes("econnreset") ||
      message.includes("socket hang up")
    ) {
      return new RetryableError(`${context}: connection error - ${err.message}`, {
        retryAfter: retryAfter as `${number}s`,
      });
    }

    // Deadlock errors are retryable
    if (message.includes("deadlock") || message.includes("lock timeout")) {
      return new RetryableError(`${context}: deadlock - ${err.message}`, {
        retryAfter: "1s" as const, // Retry quickly for deadlocks
      });
    }

    // Constraint violations are usually fatal (bad data)
    if (
      message.includes("unique constraint") ||
      message.includes("foreign key constraint") ||
      message.includes("check constraint") ||
      message.includes("not null constraint")
    ) {
      return new FatalError(`${context}: constraint violation - ${err.message}`);
    }

    // Syntax/schema errors are fatal
    if (
      message.includes("syntax error") ||
      message.includes("column") ||
      message.includes("relation") ||
      message.includes("does not exist")
    ) {
      return new FatalError(`${context}: schema error - ${err.message}`);
    }

    // Default: database errors are retryable
    return new RetryableError(`${context}: ${err.message}`, {
      retryAfter: retryAfter as `${number}s`,
    });
  }

  // Unknown errors default to retryable for database operations
  const errorMessage = err instanceof Error ? err.message : String(err);
  return new RetryableError(`${context}: ${errorMessage}`, {
    retryAfter: retryAfter as `${number}s`,
  });
}
