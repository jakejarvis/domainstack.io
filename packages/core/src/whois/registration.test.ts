/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const whoisMock = vi.hoisted(() => ({
  lookupWhois: vi.fn<typeof import("./lookup").lookupWhois>(),
}));

vi.mock("./lookup", () => whoisMock);
vi.mock("@domainstack/db/queries/domains", () => ({ upsertDomain: vi.fn<() => unknown>() }));
vi.mock("@domainstack/db/queries/providers", () => ({
  resolveOrCreateProviderId: vi.fn<() => unknown>(),
  upsertCatalogProvider: vi.fn<() => unknown>(),
}));
vi.mock("@domainstack/db/queries/registrations", () => ({
  upsertRegistration: vi.fn<() => unknown>(),
}));
vi.mock("@domainstack/edge-config", () => ({
  getProviderCatalog: vi.fn<() => unknown>().mockResolvedValue(null),
}));

import { RemoteDataUnavailableError } from "../lib/fetch-errors";
import { fetchRegistration } from "./index";

describe("fetchRegistration", () => {
  beforeEach(() => {
    whoisMock.lookupWhois.mockReset();
  });

  it("returns unsupported_tld without throwing", async () => {
    whoisMock.lookupWhois.mockResolvedValue({
      success: false,
      error: "unsupported_tld",
      detail: { code: "no_server", attempts: [] },
    });

    await expect(fetchRegistration("example.invalid")).resolves.toEqual({
      success: false,
      error: "unsupported_tld",
    });
  });

  it("throws RemoteDataUnavailableError carrying the attempt trace on timeout", async () => {
    const attempts = [
      {
        phase: "whois" as const,
        server: "whois.nic.sh",
        ok: false,
        durationMs: 5000,
        errorCode: "timeout" as const,
        error: "WHOIS read timeout (whois.nic.sh)",
        stage: "read" as const,
      },
    ];
    whoisMock.lookupWhois.mockResolvedValue({
      success: false,
      error: "timeout",
      detail: {
        message: "WHOIS read timeout (whois.nic.sh)",
        code: "timeout",
        phase: "whois",
        server: "whois.nic.sh",
        retryAfterMs: 30_000,
        attempts,
      },
    });

    const err = await fetchRegistration("executor.sh").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(RemoteDataUnavailableError);
    expect((err as RemoteDataUnavailableError).message).toBe(
      "WHOIS lookup failed: timeout (WHOIS read timeout (whois.nic.sh))",
    );
    expect((err as RemoteDataUnavailableError).details).toEqual({
      errorCode: "timeout",
      errorPhase: "whois",
      errorServer: "whois.nic.sh",
      retryAfterMs: 30_000,
      attempts,
    });
  });
});
