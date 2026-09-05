import { describe, expect, it } from "vitest";

import { createInitialState, toStep1, toStep2, toStep3 } from "./verification-state";

describe("createInitialState", () => {
  it("returns step 1 with empty domain by default", () => {
    expect(createInitialState()).toEqual({
      step: 1,
      domain: "",
      domainError: "",
    });
  });

  it("prefills domain when provided", () => {
    const state = createInitialState(null, "example.com");
    expect(state).toEqual({
      step: 1,
      domain: "example.com",
      domainError: "",
    });
  });

  it("resumes to step 2 when resumeDomain is provided", () => {
    const state = createInitialState({
      id: "td_123",
      domainName: "example.com",
      verificationToken: "token_abc",
      verificationMethod: "dns_txt",
    });

    expect(state).toEqual({
      step: 2,
      domain: "example.com",
      trackedDomainId: "td_123",
      verificationToken: "token_abc",
    });
  });

  it("resumes with an empty token when resume data has none", () => {
    const state = createInitialState({
      id: "td_123",
      domainName: "example.com",
      verificationToken: "",
      verificationMethod: null,
    });

    expect(state).toEqual({
      step: 2,
      domain: "example.com",
      trackedDomainId: "td_123",
      verificationToken: "",
    });
  });

  it("prioritizes resumeDomain over prefillDomain", () => {
    const state = createInitialState(
      {
        id: "td_123",
        domainName: "resumed.com",
        verificationToken: "token_abc",
        verificationMethod: "dns_txt",
      },
      "prefilled.com",
    );

    expect(state.step).toBe(2);
    expect(state.domain).toBe("resumed.com");
  });
});

describe("toStep1", () => {
  it("returns an empty step 1 by default", () => {
    expect(toStep1()).toEqual({
      step: 1,
      domain: "",
      domainError: "",
    });
  });

  it("prefills the domain when provided", () => {
    expect(toStep1("prefilled.com")).toEqual({
      step: 1,
      domain: "prefilled.com",
      domainError: "",
    });
  });
});

describe("toStep2", () => {
  it("builds step 2 from add or resume results", () => {
    expect(toStep2("example.com", "td_123", "token_abc")).toEqual({
      step: 2,
      domain: "example.com",
      trackedDomainId: "td_123",
      verificationToken: "token_abc",
    });
  });
});

describe("toStep3", () => {
  it("keeps domain and tracked id from step 2", () => {
    const step2 = toStep2("example.com", "td_123", "token_abc");
    expect(toStep3(step2)).toEqual({
      step: 3,
      domain: "example.com",
      trackedDomainId: "td_123",
    });
  });
});
