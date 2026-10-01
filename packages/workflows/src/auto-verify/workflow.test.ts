/* @vitest-environment node */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FatalError } from "workflow";

import type { VerificationMethod, VerificationResult } from "@domainstack/types";

// Skip the real sleeps so the 30-day schedule runs instantly. Keep the real FatalError.
vi.mock("workflow", async (importOriginal) => ({
  ...(await importOriginal<typeof import("workflow")>()),
  sleep: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

const verificationMock = vi.hoisted(() => ({
  verifyDomainByDns: vi.fn<typeof import("../steps/verification").verifyDomainByDns>(),
  verifyDomainByHtmlFile: vi.fn<typeof import("../steps/verification").verifyDomainByHtmlFile>(),
  verifyDomainByMetaTag: vi.fn<typeof import("../steps/verification").verifyDomainByMetaTag>(),
}));

const trackedDomainsMock = vi.hoisted(() => ({
  findTrackedDomainWithDomainName:
    vi.fn<
      typeof import("@domainstack/db/queries/tracked-domains").findTrackedDomainWithDomainName
    >(),
  verifyTrackedDomain:
    vi.fn<typeof import("@domainstack/db/queries/tracked-domains").verifyTrackedDomain>(),
}));

vi.mock("../steps/verification", () => verificationMock);
vi.mock("@domainstack/db/queries/tracked-domains", () => trackedDomainsMock);

// Load the module (and its SDK imports) under the hook timeout instead of
// inside the first test's budget.
beforeAll(async () => {
  await import("./workflow");
});

// Mirrors RETRY_DELAYS_MS.length in ./workflow.
const ATTEMPTS = 14;

const baseRow = {
  id: "td-1",
  userId: "u1",
  domainName: "example.com",
  verificationToken: "tok",
  verificationMethod: null,
  verified: false,
  verificationStatus: "unverified" as const,
  archivedAt: null,
};

const NOT_VERIFIED: VerificationResult = { verified: false, method: null };
const verifiedBy = (method: VerificationMethod): VerificationResult => ({ verified: true, method });

async function run() {
  const { autoVerifyWorkflow } = await import("./workflow");
  return autoVerifyWorkflow({ trackedDomainId: "td-1" });
}

function expectNoVerifyStepsCalled() {
  expect(verificationMock.verifyDomainByDns).not.toHaveBeenCalled();
  expect(verificationMock.verifyDomainByHtmlFile).not.toHaveBeenCalled();
  expect(verificationMock.verifyDomainByMetaTag).not.toHaveBeenCalled();
}

describe("autoVerifyWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    trackedDomainsMock.findTrackedDomainWithDomainName.mockResolvedValue(baseRow);
    trackedDomainsMock.verifyTrackedDomain.mockResolvedValue({
      id: "td-1",
      domainId: "d-1",
    } as never);
    verificationMock.verifyDomainByDns.mockResolvedValue(NOT_VERIFIED);
    verificationMock.verifyDomainByHtmlFile.mockResolvedValue(NOT_VERIFIED);
    verificationMock.verifyDomainByMetaTag.mockResolvedValue(NOT_VERIFIED);
  });

  it("marks the domain verified when DNS verifies on the first attempt", async () => {
    verificationMock.verifyDomainByDns.mockResolvedValue(verifiedBy("dns_txt"));

    const result = await run();

    expect(result).toEqual({
      result: "verified",
      trackedDomainId: "td-1",
      domainId: "d-1",
      domainName: "example.com",
      verifiedMethod: "dns_txt",
      attempt: 1,
    });
    expect(trackedDomainsMock.verifyTrackedDomain).toHaveBeenCalledWith("td-1", "dns_txt");
  });

  it("verifies by meta tag when it is the only method that matches", async () => {
    verificationMock.verifyDomainByMetaTag.mockResolvedValue(verifiedBy("meta_tag"));

    const result = await run();

    expect(result).toMatchObject({ result: "verified", verifiedMethod: "meta_tag" });
    expect(trackedDomainsMock.verifyTrackedDomain).toHaveBeenCalledWith("td-1", "meta_tag");
  });

  it("prefers DNS over the other methods when several verify", async () => {
    verificationMock.verifyDomainByDns.mockResolvedValue(verifiedBy("dns_txt"));
    verificationMock.verifyDomainByHtmlFile.mockResolvedValue(verifiedBy("html_file"));

    const result = await run();

    expect(result).toMatchObject({ result: "verified", verifiedMethod: "dns_txt" });
  });

  it("still verifies by DNS when another method's step rejects", async () => {
    verificationMock.verifyDomainByDns.mockResolvedValue(verifiedBy("dns_txt"));
    verificationMock.verifyDomainByHtmlFile.mockRejectedValue(new Error("html step crashed"));

    const result = await run();

    expect(result).toMatchObject({ result: "verified", verifiedMethod: "dns_txt", attempt: 1 });
    expect(trackedDomainsMock.verifyTrackedDomain).toHaveBeenCalledWith("td-1", "dns_txt");
  });

  it("cancels when the tracked domain was deleted", async () => {
    trackedDomainsMock.findTrackedDomainWithDomainName.mockResolvedValue(null);

    const result = await run();

    expect(result).toEqual({ result: "cancelled", reason: "domain_deleted" });
    expectNoVerifyStepsCalled();
  });

  it("cancels when the user verified the domain in the meantime", async () => {
    trackedDomainsMock.findTrackedDomainWithDomainName.mockResolvedValue({
      ...baseRow,
      verified: true,
      verificationStatus: "verified",
    });

    const result = await run();

    expect(result).toEqual({ result: "cancelled", reason: "already_verified" });
    expectNoVerifyStepsCalled();
  });

  it("cancels when the tracked domain was archived", async () => {
    trackedDomainsMock.findTrackedDomainWithDomainName.mockResolvedValue({
      ...baseRow,
      archivedAt: new Date("2026-09-01T00:00:00Z"),
    });

    const result = await run();

    expect(result).toEqual({ result: "cancelled", reason: "domain_archived" });
    expectNoVerifyStepsCalled();
  });

  it("skips an attempt with a missing token and verifies on the next one", async () => {
    trackedDomainsMock.findTrackedDomainWithDomainName
      .mockResolvedValueOnce({ ...baseRow, verificationToken: "" })
      .mockResolvedValue(baseRow);
    verificationMock.verifyDomainByDns.mockResolvedValue(verifiedBy("dns_txt"));

    const result = await run();

    expect(result).toMatchObject({ result: "verified", attempt: 2 });
    expect(verificationMock.verifyDomainByDns).toHaveBeenCalledTimes(1);
  });

  it("exhausts the schedule when nothing ever verifies", async () => {
    const result = await run();

    expect(result).toMatchObject({ result: "exhausted" });
    expect(verificationMock.verifyDomainByDns).toHaveBeenCalledTimes(ATTEMPTS);
    expect(verificationMock.verifyDomainByHtmlFile).toHaveBeenCalledTimes(ATTEMPTS);
    expect(verificationMock.verifyDomainByMetaTag).toHaveBeenCalledTimes(ATTEMPTS);
    expect(trackedDomainsMock.verifyTrackedDomain).not.toHaveBeenCalled();
  });

  it("fails the run with a FatalError when the domain can't be marked verified", async () => {
    verificationMock.verifyDomainByDns.mockResolvedValue(verifiedBy("dns_txt"));
    trackedDomainsMock.verifyTrackedDomain.mockResolvedValue(null);

    await expect(run()).rejects.toBeInstanceOf(FatalError);
  });
});
