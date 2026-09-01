/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { waitUntil } = vi.hoisted(() => ({
  waitUntil: vi.fn<(promise: Promise<unknown>) => void>(),
}));

vi.mock("@vercel/functions", () => ({
  waitUntil,
}));

import { scheduleBackground } from "./wait-until";

const VERCEL_REQUEST_CONTEXT = Symbol.for("@vercel/request-context");

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("scheduleBackground", () => {
  const originalRequestContext = Reflect.get(globalThis, VERCEL_REQUEST_CONTEXT);

  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.deleteProperty(globalThis, VERCEL_REQUEST_CONTEXT);
  });

  afterEach(() => {
    if (originalRequestContext === undefined) {
      Reflect.deleteProperty(globalThis, VERCEL_REQUEST_CONTEXT);
    } else {
      Reflect.set(globalThis, VERCEL_REQUEST_CONTEXT, originalRequestContext);
    }
  });

  it("awaits work when no request context exists", async () => {
    const work = deferred<boolean>();

    let settled = false;
    const pending = scheduleBackground(work.promise).then(() => {
      settled = true;
    });

    expect(waitUntil).not.toHaveBeenCalled();
    expect(settled).toBe(false);

    work.resolve(true);
    await expect(pending).resolves.toBeUndefined();
    expect(settled).toBe(true);
  });

  it("schedules via waitUntil when request context exists", async () => {
    const contextWaitUntil = vi.fn<(promise: Promise<unknown>) => void>();
    Reflect.set(globalThis, VERCEL_REQUEST_CONTEXT, {
      get: () => ({ waitUntil: contextWaitUntil }),
    });

    const work = deferred<boolean>();

    await expect(scheduleBackground(work.promise)).resolves.toBeUndefined();

    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalledWith(work.promise);
    expect(contextWaitUntil).not.toHaveBeenCalled();

    work.resolve(true);
  });
});
