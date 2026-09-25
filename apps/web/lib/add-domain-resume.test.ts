import { describe, expect, it } from "vitest";

import { addDomainResumeHref, parseResumeDomain } from "@/lib/add-domain-resume";

function params(entries: Record<string, string>) {
  return new URLSearchParams(entries);
}

describe("parseResumeDomain", () => {
  it("returns null when resume is missing, not true, or search params are absent", () => {
    expect(parseResumeDomain(params({ id: "domain-1" }))).toBeNull();
    expect(parseResumeDomain(params({ resume: "1", id: "domain-1" }))).toBeNull();
    expect(parseResumeDomain(params({}))).toBeNull();
    expect(parseResumeDomain(null)).toBeNull();
    expect(parseResumeDomain(undefined)).toBeNull();
  });

  it("returns null when resume is true but id is missing", () => {
    expect(parseResumeDomain(params({ resume: "true", domain: "pending.dev" }))).toBeNull();
  });

  it("builds resume data from id, optional domain, and method", () => {
    expect(
      parseResumeDomain(
        params({
          resume: "true",
          id: "domain-pending",
          domain: "pending.dev",
          method: "dns_txt",
        }),
      ),
    ).toEqual({
      id: "domain-pending",
      domainName: "pending.dev",
      verificationToken: "",
      verificationMethod: "dns_txt",
    });
  });

  it("falls back to an empty domain name and drops invalid methods", () => {
    expect(parseResumeDomain(params({ resume: "true", id: "domain-pending" }))).toEqual({
      id: "domain-pending",
      domainName: "",
      verificationToken: "",
      verificationMethod: null,
    });
    expect(
      parseResumeDomain(params({ resume: "true", id: "domain-pending", method: "nope" })),
    ).toEqual({
      id: "domain-pending",
      domainName: "",
      verificationToken: "",
      verificationMethod: null,
    });
  });
});

describe("addDomainResumeHref", () => {
  it("links to the add-domain flow with the id and method", () => {
    expect(addDomainResumeHref("domain-1", "html_file")).toBe(
      "/dashboard/add-domain?resume=true&id=domain-1&method=html_file",
    );
    expect(addDomainResumeHref("domain-1", null)).toBe(
      "/dashboard/add-domain?resume=true&id=domain-1",
    );
  });

  it("round-trips through parseResumeDomain", () => {
    const href = addDomainResumeHref("domain-1", "meta_tag");
    const parsed = parseResumeDomain(new URL(href, "https://domainstack.test").searchParams);
    expect(parsed).toEqual({
      id: "domain-1",
      domainName: "",
      verificationToken: "",
      verificationMethod: "meta_tag",
    });
  });
});
