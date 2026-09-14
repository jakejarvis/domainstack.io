/* @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

const branchMocks = vi.hoisted(() => ({
  checkDomainExpiry: vi.fn<typeof import("./domain").checkDomainExpiry>(),
  checkCertificateExpiry: vi.fn<typeof import("./certificate").checkCertificateExpiry>(),
}));

vi.mock("./domain", () => ({ checkDomainExpiry: branchMocks.checkDomainExpiry }));
vi.mock("./certificate", () => ({ checkCertificateExpiry: branchMocks.checkCertificateExpiry }));

describe("expiryWorkflow", () => {
  it("returns both branch results under { domain, certificate }", async () => {
    branchMocks.checkDomainExpiry.mockResolvedValue({ skipped: true, reason: "not_found" });
    branchMocks.checkCertificateExpiry.mockResolvedValue({ skipped: false, sent: true });

    const { expiryWorkflow } = await import("./workflow");
    const result = await expiryWorkflow({ trackedDomainId: "td-1" });

    expect(result).toEqual({
      domain: { skipped: true, reason: "not_found" },
      certificate: { skipped: false, sent: true },
    });
    expect(branchMocks.checkDomainExpiry).toHaveBeenCalledWith({ trackedDomainId: "td-1" });
    expect(branchMocks.checkCertificateExpiry).toHaveBeenCalledWith({ trackedDomainId: "td-1" });
  });

  it("a domain rejection does not prevent the certificate branch from completing, and fails the parent", async () => {
    const domainError = new Error("domain branch exhausted");
    branchMocks.checkDomainExpiry.mockRejectedValue(domainError);
    branchMocks.checkCertificateExpiry.mockResolvedValue({ skipped: false, sent: true });

    const { expiryWorkflow } = await import("./workflow");

    await expect(expiryWorkflow({ trackedDomainId: "td-1" })).rejects.toThrow(
      "domain branch exhausted",
    );
    expect(branchMocks.checkCertificateExpiry).toHaveBeenCalledWith({ trackedDomainId: "td-1" });
  });

  it("a certificate rejection does not prevent the domain branch from completing, and fails the parent", async () => {
    const certificateError = new Error("certificate branch exhausted");
    branchMocks.checkDomainExpiry.mockResolvedValue({ skipped: false, sent: true });
    branchMocks.checkCertificateExpiry.mockRejectedValue(certificateError);

    const { expiryWorkflow } = await import("./workflow");

    await expect(expiryWorkflow({ trackedDomainId: "td-1" })).rejects.toThrow(
      "certificate branch exhausted",
    );
    expect(branchMocks.checkDomainExpiry).toHaveBeenCalledWith({ trackedDomainId: "td-1" });
  });
});
