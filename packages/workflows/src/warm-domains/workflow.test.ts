/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RemoteDataUnavailableError } from "@domainstack/core/lib/fetch-errors";

const cacheMocks = vi.hoisted(() => ({
  getCachedRegistration:
    vi.fn<typeof import("@domainstack/db/queries/registrations").getCachedRegistration>(),
  getCachedHosting: vi.fn<typeof import("@domainstack/db/queries/hosting").getCachedHosting>(),
  getCachedCertificates:
    vi.fn<typeof import("@domainstack/db/queries/certificates").getCachedCertificates>(),
  getCachedHeaders: vi.fn<typeof import("@domainstack/db/queries/headers").getCachedHeaders>(),
  getCachedSeo: vi.fn<typeof import("@domainstack/db/queries/seo").getCachedSeo>(),
}));

const fetchMocks = vi.hoisted(() => ({
  fetchRegistration: vi.fn<typeof import("@domainstack/core/whois").fetchRegistration>(),
  fetchHosting: vi.fn<typeof import("@domainstack/core/hosting").fetchHosting>(),
  fetchCertificates: vi.fn<typeof import("@domainstack/core/tls").fetchCertificates>(),
  fetchHeaders: vi.fn<typeof import("@domainstack/core/headers").fetchHeaders>(),
  fetchSeo: vi.fn<typeof import("@domainstack/core/seo").fetchSeo>(),
  fetchDns: vi.fn<typeof import("@domainstack/core/dns").fetchDns>(),
}));

vi.mock("@domainstack/db/queries/registrations", () => ({
  getCachedRegistration: cacheMocks.getCachedRegistration,
}));
vi.mock("@domainstack/db/queries/hosting", () => ({
  getCachedHosting: cacheMocks.getCachedHosting,
}));
vi.mock("@domainstack/db/queries/certificates", () => ({
  getCachedCertificates: cacheMocks.getCachedCertificates,
}));
vi.mock("@domainstack/db/queries/headers", () => ({
  getCachedHeaders: cacheMocks.getCachedHeaders,
}));
vi.mock("@domainstack/db/queries/seo", () => ({
  getCachedSeo: cacheMocks.getCachedSeo,
}));
vi.mock("@domainstack/core/whois", () => ({
  fetchRegistration: fetchMocks.fetchRegistration,
}));
vi.mock("@domainstack/core/hosting", () => ({
  fetchHosting: fetchMocks.fetchHosting,
}));
vi.mock("@domainstack/core/tls", () => ({
  fetchCertificates: fetchMocks.fetchCertificates,
}));
vi.mock("@domainstack/core/headers", () => ({
  fetchHeaders: fetchMocks.fetchHeaders,
}));
vi.mock("@domainstack/core/seo", () => ({
  fetchSeo: fetchMocks.fetchSeo,
}));
vi.mock("@domainstack/core/dns", () => ({
  fetchDns: fetchMocks.fetchDns,
}));

beforeEach(() => {
  vi.clearAllMocks();

  const cached = {
    data: {},
    stale: false,
    fetchedAt: new Date(),
    expiresAt: new Date(Date.now() + 86_400_000),
  };
  cacheMocks.getCachedRegistration.mockResolvedValue(cached as never);
  cacheMocks.getCachedHosting.mockResolvedValue(cached as never);
  cacheMocks.getCachedCertificates.mockResolvedValue(cached as never);
  cacheMocks.getCachedHeaders.mockResolvedValue(cached as never);
  cacheMocks.getCachedSeo.mockResolvedValue(cached as never);

  fetchMocks.fetchRegistration.mockResolvedValue({ success: true, data: {} } as never);
  fetchMocks.fetchHosting.mockResolvedValue({ success: true, data: {} } as never);
  fetchMocks.fetchCertificates.mockResolvedValue({ success: true, data: {} } as never);
  fetchMocks.fetchHeaders.mockResolvedValue({ success: true, data: {} } as never);
  fetchMocks.fetchSeo.mockResolvedValue({ success: true, data: {} } as never);
});

/** A cached section expiring before the next warm run. */
function due() {
  return {
    data: {},
    stale: false,
    fetchedAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
  } as never;
}

const notCached = { data: null, stale: false, fetchedAt: null, expiresAt: null };

describe("warmDomainWorkflow", () => {
  it("warms a parent's registration without fetching sections nobody viewed", async () => {
    // A subdomain report looked up example.com's registration only.
    cacheMocks.getCachedRegistration.mockResolvedValue(due());
    cacheMocks.getCachedHosting.mockResolvedValue(notCached);
    cacheMocks.getCachedCertificates.mockResolvedValue(notCached);
    cacheMocks.getCachedHeaders.mockResolvedValue(notCached);
    cacheMocks.getCachedSeo.mockResolvedValue(notCached);

    const { warmDomainWorkflow } = await import("./workflow");
    const result = await warmDomainWorkflow({ domain: "example.com" });

    expect(fetchMocks.fetchRegistration).toHaveBeenCalledWith("example.com");
    expect(fetchMocks.fetchHosting).not.toHaveBeenCalled();
    expect(fetchMocks.fetchCertificates).not.toHaveBeenCalled();
    expect(fetchMocks.fetchHeaders).not.toHaveBeenCalled();
    expect(fetchMocks.fetchSeo).not.toHaveBeenCalled();
    expect(result).toEqual({ refreshed: ["registration"], unavailable: [] });
  });

  it("refreshes nothing when every section is fresh", async () => {
    const { warmDomainWorkflow } = await import("./workflow");
    const result = await warmDomainWorkflow({ domain: "example.com" });

    expect(result).toEqual({ refreshed: [], unavailable: [] });
    expect(fetchMocks.fetchRegistration).not.toHaveBeenCalled();
    expect(fetchMocks.fetchHosting).not.toHaveBeenCalled();
    expect(fetchMocks.fetchCertificates).not.toHaveBeenCalled();
    expect(fetchMocks.fetchHeaders).not.toHaveBeenCalled();
    expect(fetchMocks.fetchSeo).not.toHaveBeenCalled();
  });

  it("refreshes only the sections that are due", async () => {
    cacheMocks.getCachedSeo.mockResolvedValue(due());
    cacheMocks.getCachedRegistration.mockResolvedValue(due());

    const { warmDomainWorkflow } = await import("./workflow");
    const result = await warmDomainWorkflow({ domain: "example.com" });

    expect(fetchMocks.fetchSeo).toHaveBeenCalledTimes(1);
    expect(fetchMocks.fetchSeo).toHaveBeenCalledWith("example.com");
    expect(fetchMocks.fetchRegistration).toHaveBeenCalledTimes(1);
    expect(fetchMocks.fetchRegistration).toHaveBeenCalledWith("example.com");
    expect(result).toEqual({ refreshed: ["registration", "seo"], unavailable: [] });
  });

  it("never fetches registration for a subdomain row", async () => {
    cacheMocks.getCachedRegistration.mockResolvedValue(due());
    cacheMocks.getCachedHosting.mockResolvedValue(due());
    cacheMocks.getCachedCertificates.mockResolvedValue(due());
    cacheMocks.getCachedSeo.mockResolvedValue(due());

    const { warmDomainWorkflow } = await import("./workflow");
    const result = await warmDomainWorkflow({ domain: "api.example.com" });

    expect(cacheMocks.getCachedRegistration).not.toHaveBeenCalled();
    expect(fetchMocks.fetchRegistration).not.toHaveBeenCalled();
    expect(fetchMocks.fetchHosting).toHaveBeenCalledWith("api.example.com");
    expect(fetchMocks.fetchCertificates).toHaveBeenCalledWith("api.example.com");
    expect(fetchMocks.fetchSeo).toHaveBeenCalledWith("api.example.com");
    expect(result).toEqual({ refreshed: ["hosting", "certificates", "seo"], unavailable: [] });
  });

  it("treats www as a subdomain row too", async () => {
    cacheMocks.getCachedRegistration.mockResolvedValue(due());

    const { warmDomainWorkflow } = await import("./workflow");
    await warmDomainWorkflow({ domain: "www.example.com" });

    expect(fetchMocks.fetchRegistration).not.toHaveBeenCalled();
  });

  it("refreshes hosting instead of headers when both are due, and never touches dns directly", async () => {
    const dueSoon = {
      data: {},
      stale: false,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    };
    cacheMocks.getCachedHosting.mockResolvedValue(dueSoon as never);
    cacheMocks.getCachedHeaders.mockResolvedValue(dueSoon as never);

    const { warmDomainWorkflow } = await import("./workflow");
    await warmDomainWorkflow({ domain: "example.com" });

    expect(fetchMocks.fetchHosting).toHaveBeenCalledTimes(1);
    expect(fetchMocks.fetchHeaders).not.toHaveBeenCalled();
    expect(fetchMocks.fetchDns).not.toHaveBeenCalled();
  });

  it("records unavailable when a fetch rejects with RemoteDataUnavailableError", async () => {
    cacheMocks.getCachedSeo.mockResolvedValue(due());
    fetchMocks.fetchSeo.mockRejectedValue(new RemoteDataUnavailableError("down"));

    const { warmDomainWorkflow } = await import("./workflow");
    const result = await warmDomainWorkflow({ domain: "example.com" });

    expect(result).toEqual({ refreshed: [], unavailable: ["seo"] });
  });

  it("records unavailable when a fetch resolves with success: false", async () => {
    cacheMocks.getCachedCertificates.mockResolvedValue(due());
    fetchMocks.fetchCertificates.mockResolvedValue({
      success: false,
      error: "tls_error",
    });

    const { warmDomainWorkflow } = await import("./workflow");
    const result = await warmDomainWorkflow({ domain: "example.com" });

    expect(result).toEqual({ refreshed: [], unavailable: ["certificates"] });
  });

  it("rejects when a fetch throws an unclassified error, without blocking the other section", async () => {
    cacheMocks.getCachedRegistration.mockResolvedValue(due());
    cacheMocks.getCachedSeo.mockResolvedValue(due());
    fetchMocks.fetchRegistration.mockRejectedValue(new Error("db write failed"));

    const { warmDomainWorkflow } = await import("./workflow");

    await expect(warmDomainWorkflow({ domain: "example.com" })).rejects.toThrow("db write failed");
    expect(fetchMocks.fetchSeo).toHaveBeenCalledWith("example.com");
  });

  it("rejects and calls no fetcher when checking cache freshness fails", async () => {
    cacheMocks.getCachedHosting.mockRejectedValue(new Error("connection refused"));

    const { warmDomainWorkflow } = await import("./workflow");

    await expect(warmDomainWorkflow({ domain: "example.com" })).rejects.toThrow("connection error");
    expect(fetchMocks.fetchRegistration).not.toHaveBeenCalled();
    expect(fetchMocks.fetchHosting).not.toHaveBeenCalled();
    expect(fetchMocks.fetchCertificates).not.toHaveBeenCalled();
    expect(fetchMocks.fetchHeaders).not.toHaveBeenCalled();
    expect(fetchMocks.fetchSeo).not.toHaveBeenCalled();
  });
});
