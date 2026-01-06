/* @vitest-environment node */
import type * as tls from "node:tls";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock workflow/api module
const workflowMock = vi.hoisted(() => ({
  start: vi.fn(),
}));

vi.mock("workflow/api", () => workflowMock);

// Mock scheduleRevalidation to avoid Inngest API calls in tests
vi.mock("@/lib/schedule", () => ({
  scheduleRevalidation: vi.fn().mockResolvedValue(true),
}));

// Mock next/server's after() to run callback synchronously
vi.mock("next/server", () => ({
  after: vi.fn((fn: () => void) => fn()),
}));

describe("getCertificates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns certificate chain from successful workflow", async () => {
    workflowMock.start.mockReturnValue({
      runId: "test-run-1",
      returnValue: Promise.resolve({
        success: true,
        cached: false,
        data: {
          certificates: [
            {
              issuer: "Let's Encrypt",
              subject: "example.com",
              altNames: ["example.com", "www.example.com"],
              validFrom: "2024-01-01T00:00:00.000Z",
              validTo: "2024-04-01T00:00:00.000Z",
              caProvider: {
                id: "prov-1",
                name: "Let's Encrypt",
                domain: "letsencrypt.org",
              },
            },
          ],
        },
      }),
    });

    const { getCertificates } = await import("./certificates");
    const result = await getCertificates("example.com");

    expect(workflowMock.start).toHaveBeenCalledOnce();
    expect(result.certificates).toHaveLength(1);
    expect(result.certificates[0].issuer).toBe("Let's Encrypt");
    expect(result.certificates[0].caProvider?.name).toBe("Let's Encrypt");
  });

  it("returns cached certificates without scheduling revalidation", async () => {
    workflowMock.start.mockReturnValue({
      runId: "test-run-2",
      returnValue: Promise.resolve({
        success: true,
        cached: true,
        data: {
          certificates: [
            {
              issuer: "DigiCert",
              subject: "cached.com",
              altNames: [],
              validFrom: "2024-01-01T00:00:00.000Z",
              validTo: "2024-12-31T00:00:00.000Z",
              caProvider: { id: null, name: null, domain: null },
            },
          ],
        },
      }),
    });

    const { scheduleRevalidation } = await import("@/lib/schedule");
    const { getCertificates } = await import("./certificates");
    await getCertificates("cached.com");

    // Cached results should NOT trigger scheduling
    expect(scheduleRevalidation).not.toHaveBeenCalled();
  });

  it("schedules revalidation for non-cached successful results", async () => {
    workflowMock.start.mockReturnValue({
      runId: "test-run-3",
      returnValue: Promise.resolve({
        success: true,
        cached: false,
        data: {
          certificates: [
            {
              issuer: "Google Trust Services",
              subject: "fresh.com",
              altNames: [],
              validFrom: "2024-01-01T00:00:00.000Z",
              validTo: "2024-06-01T00:00:00.000Z",
              caProvider: { id: null, name: null, domain: null },
            },
          ],
        },
      }),
    });

    const { scheduleRevalidation } = await import("@/lib/schedule");
    const { getCertificates } = await import("./certificates");
    await getCertificates("fresh.com");

    // Non-cached results SHOULD trigger scheduling
    expect(scheduleRevalidation).toHaveBeenCalledWith(
      "fresh.com",
      "certificates",
      expect.any(Number),
      null,
    );
  });

  it("skips scheduling when skipScheduling option is true", async () => {
    workflowMock.start.mockReturnValue({
      runId: "test-run-4",
      returnValue: Promise.resolve({
        success: true,
        cached: false,
        data: {
          certificates: [],
        },
      }),
    });

    const { scheduleRevalidation } = await import("@/lib/schedule");
    const { getCertificates } = await import("./certificates");
    await getCertificates("skip.com", { skipScheduling: true });

    expect(scheduleRevalidation).not.toHaveBeenCalled();
  });

  it("returns empty certificates for DNS error", async () => {
    workflowMock.start.mockReturnValue({
      runId: "test-run-5",
      returnValue: Promise.resolve({
        success: false,
        cached: false,
        error: "dns_error",
        data: {
          certificates: [],
        },
      }),
    });

    const { getCertificates } = await import("./certificates");
    const result = await getCertificates("nonexistent.invalid");

    expect(result.certificates).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it("returns error message for TLS error", async () => {
    workflowMock.start.mockReturnValue({
      runId: "test-run-6",
      returnValue: Promise.resolve({
        success: false,
        cached: false,
        error: "tls_error",
        data: {
          certificates: [],
          error: "Invalid SSL certificate",
        },
      }),
    });

    const { getCertificates } = await import("./certificates");
    const result = await getCertificates("invalid-ssl.com");

    expect(result.certificates).toHaveLength(0);
    expect(result.error).toBe("Invalid SSL certificate");
  });

  it("returns multiple certificates in chain order", async () => {
    workflowMock.start.mockReturnValue({
      runId: "test-run-7",
      returnValue: Promise.resolve({
        success: true,
        cached: false,
        data: {
          certificates: [
            {
              issuer: "Intermediate CA",
              subject: "example.com",
              altNames: ["example.com"],
              validFrom: "2024-01-01T00:00:00.000Z",
              validTo: "2024-04-01T00:00:00.000Z",
              caProvider: { id: null, name: null, domain: null },
            },
            {
              issuer: "Root CA",
              subject: "Intermediate CA",
              altNames: [],
              validFrom: "2020-01-01T00:00:00.000Z",
              validTo: "2030-01-01T00:00:00.000Z",
              caProvider: { id: null, name: null, domain: null },
            },
          ],
        },
      }),
    });

    const { getCertificates } = await import("./certificates");
    const result = await getCertificates("example.com");

    expect(result.certificates).toHaveLength(2);
    expect(result.certificates[0].subject).toBe("example.com");
    expect(result.certificates[1].subject).toBe("Intermediate CA");
  });

  it("throws error when workflow itself throws", async () => {
    workflowMock.start.mockReturnValue({
      runId: "test-run-8",
      returnValue: Promise.reject(new Error("Workflow crashed")),
    });

    const { getCertificates } = await import("./certificates");

    await expect(getCertificates("crash.com")).rejects.toThrow(
      "Workflow crashed",
    );
  });
});

describe("tls helper parsing", () => {
  it("parseAltNames extracts DNS/IP values and ignores others", async () => {
    const input = "DNS:example.test, IP Address:1.2.3.4, URI:http://x";
    const { parseAltNames } = await import("./certificates");
    expect(parseAltNames(input)).toEqual(["example.test", "1.2.3.4"]);
  });

  it("parseAltNames handles empty/missing", async () => {
    const { parseAltNames } = await import("./certificates");
    expect(parseAltNames(undefined)).toEqual([]);
    expect(parseAltNames("")).toEqual([]);
  });

  it("toName prefers CN then O then stringifies", () => {
    const cnOnly = {
      CN: "cn.example",
    } as unknown as tls.PeerCertificate["subject"];
    const orgOnly = { O: "Org" } as unknown as tls.PeerCertificate["subject"];
    const other = { X: "Y" } as unknown as tls.PeerCertificate["subject"];
    return import("./certificates").then(({ toName }) => {
      expect(toName(cnOnly)).toBe("cn.example");
      expect(toName(orgOnly)).toBe("Org");
      expect(toName(other)).toContain("X");
    });
  });
});
