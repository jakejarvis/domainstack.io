import { beforeEach, describe, expect, it, vi } from "vitest";

import { acquireMonitorLock, releaseMonitorLock } from "@/lib/workflow/monitor-dedup";
import { getRedis } from "@domainstack/redis";

const setMock =
  vi.fn<(key: string, value: string, options: { nx: true; ex: number }) => Promise<"OK" | null>>();
const evalMock = vi.fn<(script: string, keys: string[], args: string[]) => Promise<number>>();

function useMockRedis(): void {
  vi.mocked(getRedis).mockReturnValue({
    set: setMock,
    eval: evalMock,
  } as unknown as NonNullable<ReturnType<typeof getRedis>>);
}

describe("monitor deduplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMockRedis();
  });

  it("stores and returns a unique owner token when acquiring a lock", async () => {
    setMock.mockResolvedValue("OK");

    const ownerToken = await acquireMonitorLock("tracked-1");

    expect(ownerToken).toEqual(expect.any(String));
    expect(setMock).toHaveBeenCalledWith("monitor:detect-changes:tracked-1", ownerToken, {
      nx: true,
      ex: 90 * 60,
    });
  });

  it("returns null when another workflow owns the lock", async () => {
    setMock.mockResolvedValue(null);

    await expect(acquireMonitorLock("tracked-1")).resolves.toBeNull();
  });

  it("compares the owner token before deleting a lock", async () => {
    evalMock.mockResolvedValue(0);

    await releaseMonitorLock("tracked-1", "owner-1");

    expect(evalMock).toHaveBeenCalledOnce();
    const [script, keys, args] = evalMock.mock.calls[0] ?? [];
    expect(script).toContain('redis.call("get", KEYS[1]) == ARGV[1]');
    expect(script).toContain('redis.call("del", KEYS[1])');
    expect(keys).toEqual(["monitor:detect-changes:tracked-1"]);
    expect(args).toEqual(["owner-1"]);
  });

  it("fails open when Redis cannot acquire the lock", async () => {
    setMock.mockRejectedValue(new Error("Redis unavailable"));

    await expect(acquireMonitorLock("tracked-1")).resolves.toEqual(expect.any(String));
  });
});
