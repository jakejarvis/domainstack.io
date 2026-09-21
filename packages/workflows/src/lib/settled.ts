/**
 * Helpers for mixed-criticality parallel steps.
 *
 * Workflow SDK v5: a thrown step error rejects `Promise.all` and fails the run.
 * Use `Promise.allSettled` plus these unwraps so optional enrichment can fail
 * without aborting required work.
 */

import { FatalError } from "workflow";

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
 *
 * A swallowed `FatalError` is logged first: it signals a structural bug
 * (e.g. a constraint/schema violation from `classifyDatabaseError`), not an
 * expected transient miss, so it must stay visible even though it can't be
 * allowed to fail the parent workflow. The logging itself runs in a step:
 * this function runs directly in the workflow body (it isn't itself a
 * step), which the workflow SDK bundles separately and forbids Node-only
 * dependencies like the pino-backed logger from reaching at all — even via
 * a dynamic import.
 */
export async function optionalCall<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof FatalError) {
      await logSwallowedFatalStep(err.message);
    }
    return null;
  }
}

async function logSwallowedFatalStep(errorMessage: string): Promise<void> {
  "use step";

  const { createLogger } = await import("@domainstack/logger");
  createLogger({ source: "workflows/settled" }).error(
    { errorMessage },
    "optional workflow step failed fatally; continuing without it",
  );
}
