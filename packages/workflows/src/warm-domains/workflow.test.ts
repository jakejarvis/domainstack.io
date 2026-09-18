/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RemoteDataUnavailableError } from "@domainstack/core/services/fetch-errors";

const cacheMocks = vi.hoisted(() => ({
  getCachedRegistration:
    vi.fn<typeof import("@domainstack/db/queries/registrations").getCachedRegistration>(),
  getCachedHosting: vi.fn<typeof import("@domainstack/db/queries/hosting").getCachedHosting>(),
  getCachedTechnologies:
    vi.fn<typeof import("@domainstack/db/queries/technologies").getCachedTechnologies>(),
  getCachedCertificates:
    vi.fn<typeof import("@domainstack/db/queries/certificates").getCachedCertificates>(),
  getCachedHeaders: vi.fn<typeof import("@domainstack/db/queries/headers").getCachedHeaders>(),
  getCachedSeo: vi.fn<typeof import("@domainstack/db/queries/seo").getCachedSeo>(),
}));

const fetchMocks = vi.hoisted(() => ({
  fetchRegistration:
    vi.fn<typeof import("@domainstack/core/services/registration").fetchRegistration>(),
  fetchHosting: vi.fn<typeof import("@domainstack/core/services/hosting").fetchHosting>(),
  fetchTechnologies:
    vi.fn<typeof import("@domainstack/core/services/technologies").fetchTechnologies>(),
  fetchCertificates:
    vi.fn<typeof import("@domainstack/core/services/certificates").fetchCertificates>(),
  fetchHeaders: vi.fn<typeof import("@domainstack/core/services/headers").fetchHeaders>(),
  fetchSeo: vi.fn<typeof import("@domainstack/core/services/seo").fetchSeo>(),
  fetchDns: vi.fn<typeof import("@domainstack/core/services/dns").fetchDns>(),
}));

vi.mock("@domainstack/db/queries/registrations", () => ({
  getCachedRegistration: cacheMocks.getCachedRegistration,
}));
vi.mock("@domainstack/db/queries/hosting", () => ({
  getCachedHosting: cacheMocks.getCachedHosting,
}));
vi.mock("@domainstack/db/queries/technologies", () => ({
  getCachedTechnologies: cacheMocks.getCachedTechnologies,
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
vi.mock("@domainstack/core/services/registration", () => ({
  fetchRegistration: fetchMocks.fetchRegistration,
}));
vi.mock("@domainstack/core/services/hosting", () => ({
  fetchHosting: fetchMocks.fetchHosting,
}));
vi.mock("@domainstack/core/services/technologies", () => ({
  fetchTechnologies: fetchMocks.fetchTechnologies,
}));
vi.mock("@domainstack/core/services/certificates", () => ({
  fetchCertificates: fetchMocks.fetchCertificates,
}));
vi.mock("@domainstack/core/services/headers", () => ({
  fetchHeaders: fetchMocks.fetchHeaders,
}));
vi.mock("@domainstack/core/services/seo", () => ({
  fetchSeo: fetchMocks.fetchSeo,
}));
vi.mock("@domainstack/core/services/dns", () => ({
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
  cacheMocks.getCachedTechnologies.mockResolvedValue(cached as never);
  cacheMocks.getCachedCertificates.mockResolvedValue(cached as never);
  cacheMocks.getCachedHeaders.mockResolvedValue(cached as never);
  cacheMocks.getCachedSeo.mockResolvedValue(cached as never);

  fetchMocks.fetchRegistration.mockResolvedValue({ success: true, data: {} } as never);
  fetchMocks.fetchHosting.mockResolvedValue({ success: true, data: {} } as never);
  fetchMocks.fetchTechnologies.mockResolvedValue({ success: true, data: {} } as never);
  fetchMocks.fetchCertificates.mockResolvedValue({ success: true, data: {} } as never);
  fetchMocks.fetchHeaders.mockResolvedValue({ success: true, data: {} } as never);
  fetchMocks.fetchSeo.mockResolvedValue({ success: true, data: {} } as never);
});

describe("warmDomainWorkflow", () => {
  it("refreshes nothing when every section is fresh", async () => {
    const { warmDomainWorkflow } = await import("./workflow");
    const result = await warmDomainWorkflow({ domain: "example.com" });

    expect(result).toEqual({ refreshed: [], unavailable: [] });
    expect(fetchMocks.fetchRegistration).not.toHaveBeenCalled();
    expect(fetchMocks.fetchHosting).not.toHaveBeenCalled();
    expect(fetchMocks.fetchTechnologies).not.toHaveBeenCalled();
    expect(fetchMocks.fetchCertificates).not.toHaveBeenCalled();
    expect(fetchMocks.fetchHeaders).not.toHaveBeenCalled();
    expect(fetchMocks.fetchSeo).not.toHaveBeenCalled();
  });

  it("refreshes only the sections that are missing", async () => {
    cacheMocks.getCachedSeo.mockResolvedValue({
      data: null,
      stale: false,
      fetchedAt: null,
      expiresAt: null,
    });
    cacheMocks.getCachedRegistration.mockResolvedValue({
      data: null,
      stale: false,
      fetchedAt: null,
      expiresAt: null,
    });

    const { warmDomainWorkflow } = await import("./workflow");
    const result = await warmDomainWorkflow({ domain: "example.com" });

    expect(fetchMocks.fetchSeo).toHaveBeenCalledTimes(1);
    expect(fetchMocks.fetchSeo).toHaveBeenCalledWith("example.com");
    expect(fetchMocks.fetchRegistration).toHaveBeenCalledTimes(1);
    expect(fetchMocks.fetchRegistration).toHaveBeenCalledWith("example.com");
    expect(result).toEqual({ refreshed: ["registration", "seo"], unavailable: [] });
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
    cacheMocks.getCachedSeo.mockResolvedValue({
      data: null,
      stale: false,
      fetchedAt: null,
      expiresAt: null,
    });
    fetchMocks.fetchSeo.mockRejectedValue(new RemoteDataUnavailableError("down"));

    const { warmDomainWorkflow } = await import("./workflow");
    const result = await warmDomainWorkflow({ domain: "example.com" });

    expect(result).toEqual({ refreshed: [], unavailable: ["seo"] });
  });

  it("records unavailable when a fetch resolves with success: false", async () => {
    cacheMocks.getCachedCertificates.mockResolvedValue({
      data: null,
      stale: false,
      fetchedAt: null,
      expiresAt: null,
    });
    fetchMocks.fetchCertificates.mockResolvedValue({
      success: false,
      error: "tls_error",
    });

    const { warmDomainWorkflow } = await import("./workflow");
    const result = await warmDomainWorkflow({ domain: "example.com" });

    expect(result).toEqual({ refreshed: [], unavailable: ["certificates"] });
  });

  it("rejects when a fetch throws an unclassified error, without blocking the other section", async () => {
    cacheMocks.getCachedRegistration.mockResolvedValue({
      data: null,
      stale: false,
      fetchedAt: null,
      expiresAt: null,
    });
    cacheMocks.getCachedSeo.mockResolvedValue({
      data: null,
      stale: false,
      fetchedAt: null,
      expiresAt: null,
    });
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
    expect(fetchMocks.fetchTechnologies).not.toHaveBeenCalled();
    expect(fetchMocks.fetchCertificates).not.toHaveBeenCalled();
    expect(fetchMocks.fetchHeaders).not.toHaveBeenCalled();
    expect(fetchMocks.fetchSeo).not.toHaveBeenCalled();
  });
});
