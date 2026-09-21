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
 * A swallowed `FatalError` is logged (via a step, since this function isn't
 * one itself and can't reach the Node-only logger directly) since it signals
 * a real bug, not an expected transient miss. Uses `FatalError.is`, not
 * `instanceof`, since the error crossed the step/workflow boundary and may
 * be rehydrated without its prototype. The logging call is best-effort so it
 * can never itself turn an optional failure into a run failure.
 */
export async function optionalCall<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    if (FatalError.is(err)) {
      await logSwallowedFatalStep(err.message).catch(() => {});
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
