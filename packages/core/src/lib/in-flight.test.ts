/* @vitest-environment node */

import { describe, expect, it, vi } from "vitest";

import { shareInFlight } from "./in-flight";

describe("shareInFlight", () => {
  it("shares pending work for the same key", async () => {
    let resolve!: (value: string) => void;
    const run = vi.fn<() => Promise<string>>(
      () =>
        new Promise<string>((promiseResolve) => {
          resolve = promiseResolve;
        }),
    );

    const first = shareInFlight("same", run);
    const second = shareInFlight("same", run);
    await Promise.resolve();
    resolve("result");

    await expect(Promise.all([first, second])).resolves.toEqual(["result", "result"]);
    expect(run).toHaveBeenCalledOnce();
  });

  it("runs work independently for different keys", async () => {
    const run = vi.fn<() => Promise<string>>(async () => "result");

    await expect(
      Promise.all([shareInFlight("first", run), shareInFlight("second", run)]),
    ).resolves.toEqual(["result", "result"]);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("runs fresh work after the first promise resolves", async () => {
    const run = vi.fn<() => Promise<string>>(async () => "result");

    await shareInFlight("fresh", run);
    await shareInFlight("fresh", run);

    expect(run).toHaveBeenCalledTimes(2);
  });

  it("converts a synchronous throw into a rejected promise", async () => {
    const error = new Error("synchronous failure");
    const run = vi.fn<() => Promise<string>>(() => {
      throw error;
    });

    await expect(shareInFlight("synchronous-throw", run)).rejects.toBe(error);
    await expect(shareInFlight("synchronous-throw", run)).rejects.toBe(error);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("registers the promise before running synchronous re-entry", async () => {
    let reentrant: Promise<string> | undefined;
    const run = vi.fn<() => Promise<string>>(() => {
      reentrant = shareInFlight("reentrant", run);
      return Promise.resolve("result");
    });

    const first = shareInFlight("reentrant", run);

    await expect(first).resolves.toBe("result");
    expect(reentrant).toBe(first);
    expect(run).toHaveBeenCalledOnce();
  });

  it("shares rejections and runs fresh work after rejection", async () => {
    const error = new Error("failed");
    let reject!: (reason: Error) => void;
    const run = vi.fn<() => Promise<string>>(
      () =>
        new Promise<string>((_resolve, promiseReject) => {
          reject = promiseReject;
        }),
    );

    const first = shareInFlight("reject", run);
    const second = shareInFlight("reject", run);
    const sharedResults = Promise.allSettled([first, second]);
    await Promise.resolve();
    reject(error);

    await expect(sharedResults).resolves.toEqual([
      { status: "rejected", reason: error },
      { status: "rejected", reason: error },
    ]);
    expect(run).toHaveBeenCalledOnce();

    const next = shareInFlight("reject", run);
    const nextResult = Promise.allSettled([next]);
    await Promise.resolve();
    reject(error);

    await expect(nextResult).resolves.toEqual([{ status: "rejected", reason: error }]);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
