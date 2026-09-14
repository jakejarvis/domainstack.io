/**
 * Helpers for mixed-criticality parallel steps.
 *
 * Workflow SDK v5: a thrown step error rejects `Promise.all` and fails the run.
 * Use `Promise.allSettled` plus these unwraps so optional enrichment can fail
 * without aborting required work.
 */

/**
 * Unwrap a required step. Re-throws so the workflow run fails.
 */
export function requireSettled<T>(result: PromiseSettledResult<T>): T {
  if (result.status === "rejected") {
    throw result.reason;
  }
  return result.value;
}

/**
 * Unwrap an optional step. Rejections become `null` so the caller can skip
 * persist/enrichment without failing the parent workflow.
 */
export function optionalSettled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

/**
 * Await an optional sequential step. Thrown errors (including exhausted
 * retries) become `null` so enrichment cannot fail the parent workflow.
 */
export async function optionalCall<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}
