import { FatalError, RetryableError } from "workflow";

/** Prefix of the message drizzle-orm's `DrizzleQueryError` builds from the SQL. */
const DRIZZLE_QUERY_PREFIX = "Failed query:";

/** Postgres SQLSTATE: five digits/uppercase letters. */
const SQLSTATE = /^[0-9A-Z]{5}$/;

/** Node socket error codes (string `code`s that are not SQLSTATEs). */
const SOCKET_ERROR_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EPIPE"]);

type ChainError = { message: string; code?: string };

/**
 * Classify a database-related error into a workflow error.
 *
 * Database operations can fail transiently (connection timeouts, deadlocks,
 * temporary unavailability) and should be retried. This helper ensures
 * database errors are properly classified as retryable unless they're
 * clearly permanent (constraint violations, etc.).
 *
 * Drizzle wraps every query failure in a `DrizzleQueryError` whose message is the
 * SQL plus bound parameters and whose `cause` is the real Postgres error. Matching
 * keywords against that wrapper text would misclassify errors (parameters can
 * contain anything, e.g. raw WHOIS text) and leak parameters into the thrown
 * message, so this walks `cause`, classifies by the Postgres SQLSTATE when there
 * is one, and otherwise reads keywords from the innermost error only.
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
  const retry = { retryAfter: retryAfter as `${number}s` };

  // Preserve existing workflow errors
  if (err instanceof FatalError || err instanceof RetryableError) {
    return err;
  }

  // Unknown errors default to retryable for database operations
  if (!(err instanceof Error)) {
    return new RetryableError(`${context}: ${String(err)}`, retry);
  }

  const chain = causeChain(err);
  const innermost = chain[chain.length - 1];
  // A Drizzle wrapper with no cause carries only SQL and params: never echo those.
  const isBareWrapper = innermost.message.startsWith(DRIZZLE_QUERY_PREFIX);
  const detail = isBareWrapper ? "query failed" : innermost.message;

  // Socket codes like EPIPE are five uppercase letters too, but are not SQLSTATEs.
  const sqlState = chain
    .map((e) => e.code)
    .find((c) => c !== undefined && SQLSTATE.test(c) && !SOCKET_ERROR_CODES.has(c));
  if (sqlState) {
    if (sqlState === "40P01") {
      return new RetryableError(`${context}: deadlock - ${detail}`, {
        retryAfter: "1s" as const, // Retry quickly for deadlocks
      });
    }
    if (isTransientSqlState(sqlState)) {
      return new RetryableError(`${context}: connection error - ${detail}`, retry);
    }
    if (sqlState.startsWith("23")) {
      return new FatalError(`${context}: constraint violation - ${detail}`);
    }
    if (sqlState.startsWith("42") || sqlState.startsWith("22")) {
      return new FatalError(`${context}: schema error - ${detail}`);
    }
    return new RetryableError(`${context}: ${detail}`, retry);
  }

  // No SQLSTATE: fall back to keywords on the innermost message only
  if (!isBareWrapper) {
    const message = innermost.message.toLowerCase();
    const hasSocketCode = chain.some((e) => e.code && SOCKET_ERROR_CODES.has(e.code));

    // Connection/timeout errors are retryable
    if (
      hasSocketCode ||
      message.includes("timeout") ||
      message.includes("timed out") ||
      message.includes("connection") ||
      message.includes("econnrefused") ||
      message.includes("econnreset") ||
      message.includes("socket hang up")
    ) {
      return new RetryableError(`${context}: connection error - ${detail}`, retry);
    }

    // Deadlock errors are retryable
    if (message.includes("deadlock") || message.includes("lock timeout")) {
      return new RetryableError(`${context}: deadlock - ${detail}`, {
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
      return new FatalError(`${context}: constraint violation - ${detail}`);
    }

    // Syntax/schema errors are fatal
    if (
      message.includes("syntax error") ||
      message.includes("column") ||
      message.includes("relation") ||
      message.includes("does not exist")
    ) {
      return new FatalError(`${context}: schema error - ${detail}`);
    }
  }

  // Default: database errors are retryable
  return new RetryableError(`${context}: ${detail}`, retry);
}

/**
 * `err` followed by its `cause`s (at most 5 levels), keeping only objects with a
 * string `message`. The last entry is the innermost error.
 */
function causeChain(err: Error): ChainError[] {
  const chain: ChainError[] = [toChainError(err)];
  let current: unknown = err;
  for (let depth = 0; depth < 5; depth++) {
    current = (current as { cause?: unknown }).cause;
    if (current === null || typeof current !== "object") break;
    if (typeof (current as { message?: unknown }).message !== "string") break;
    chain.push(toChainError(current));
  }
  return chain;
}

function toChainError(value: object): ChainError {
  const { message, code } = value as { message: string; code?: unknown };
  return { message, code: typeof code === "string" ? code : undefined };
}

/** SQLSTATEs that mean "try again": connection, serialization, lock, cancel, shutdown, resources. */
function isTransientSqlState(sqlState: string): boolean {
  return (
    sqlState.startsWith("08") ||
    sqlState.startsWith("53") ||
    ["40001", "55P03", "57014", "57P01", "57P02", "57P03"].includes(sqlState)
  );
}
