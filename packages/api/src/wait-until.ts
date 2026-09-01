import { waitUntil } from "@vercel/functions";

const VERCEL_REQUEST_CONTEXT = Symbol.for("@vercel/request-context");

type VercelRequestContext = {
  waitUntil?: (promise: Promise<unknown>) => unknown;
};

function getVercelRequestContext(): VercelRequestContext | undefined {
  const holder = Reflect.get(globalThis, VERCEL_REQUEST_CONTEXT) as
    | { get?: () => VercelRequestContext | undefined }
    | undefined;
  return holder?.get?.();
}

/**
 * Keep the promise on the Vercel request when `waitUntil` is available so the
 * response is not blocked. Otherwise await, because `@vercel/functions`
 * `waitUntil` no-ops when no request context exists and the work is dropped.
 */
export async function scheduleBackground(work: Promise<unknown>): Promise<void> {
  if (typeof getVercelRequestContext()?.waitUntil === "function") {
    waitUntil(work);
    return;
  }
  await work;
}
