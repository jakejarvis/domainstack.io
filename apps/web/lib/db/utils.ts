/**
 * Check if a Postgres error is a unique constraint violation.
 */
export function isUniqueViolation(err: unknown): err is { code: string } {
  if (!err || typeof err !== "object") return false;

  // Check direct error
  if ("code" in err && (err as { code: string }).code === "23505") {
    return true;
  }

  // Check wrapped error (e.g. Drizzle/Postgres cause)
  if (
    "cause" in err &&
    err.cause &&
    typeof err.cause === "object" &&
    "code" in err.cause &&
    (err.cause as { code: string }).code === "23505"
  ) {
    return true;
  }

  return false;
}
