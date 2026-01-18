import { describe, expect, it } from "vitest";
import {
  createInitialState,
  verificationReducer,
} from "./verification-state-machine";

describe("createInitialState", () => {
  it("returns step 1 with empty domain by default", () => {
    const state = createInitialState();
    expect(state).toEqual({
      step: 1,
      domain: "",
      domainError: "",
      hasAttemptedSubmit: false,
    });
  });

  it("prefills domain when provided", () => {
    const state = createInitialState(null, "example.com");
    expect(state.step).toBe(1);
    expect(state.domain).toBe("example.com");
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
      method: "dns_txt",
      verifyStatus: "idle",
    });
  });

  it("defaults to dns_txt method when resumeDomain has no method", () => {
    const state = createInitialState({
      id: "td_123",
      domainName: "example.com",
      verificationToken: "token_abc",
      verificationMethod: null,
    });

    expect(state.step).toBe(2);
    if (state.step === 2) {
      expect(state.method).toBe("dns_txt");
    }
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

describe("verificationReducer", () => {
  describe("step 1 actions", () => {
    const step1State = createInitialState();

    it("SET_DOMAIN updates domain and clears error", () => {
      const stateWithError = {
        ...step1State,
        domainError: "Invalid domain",
      };

      const result = verificationReducer(stateWithError, {
        type: "SET_DOMAIN",
        domain: "example.com",
      });

      expect(result.domain).toBe("example.com");
      if (result.step === 1) {
        expect(result.domainError).toBe("");
      }
    });

    it("SET_DOMAIN preserves empty error state", () => {
      const result = verificationReducer(step1State, {
        type: "SET_DOMAIN",
        domain: "test.com",
      });

      if (result.step === 1) {
        expect(result.domainError).toBe("");
      }
    });

    it("SET_DOMAIN_ERROR sets error message", () => {
      const result = verificationReducer(step1State, {
        type: "SET_DOMAIN_ERROR",
        error: "Please enter a valid domain",
      });

      if (result.step === 1) {
        expect(result.domainError).toBe("Please enter a valid domain");
      }
    });

    it("ATTEMPT_SUBMIT sets hasAttemptedSubmit and clears error", () => {
      const stateWithError = {
        ...step1State,
        domainError: "Some error",
      };

      const result = verificationReducer(stateWithError, {
        type: "ATTEMPT_SUBMIT",
      });

      if (result.step === 1) {
        expect(result.hasAttemptedSubmit).toBe(true);
        expect(result.domainError).toBe("");
      }
    });

    it("DOMAIN_ADDED transitions to step 2", () => {
      const stateWithDomain = { ...step1State, domain: "example.com" };

      const result = verificationReducer(stateWithDomain, {
        type: "DOMAIN_ADDED",
        trackedDomainId: "td_123",
        verificationToken: "token_abc",
      });

      expect(result).toEqual({
        step: 2,
        domain: "example.com",
        trackedDomainId: "td_123",
        verificationToken: "token_abc",
        method: "dns_txt",
        verifyStatus: "idle",
      });
    });

    it("ignores step 2 actions when on step 1", () => {
      const result = verificationReducer(step1State, {
        type: "SET_METHOD",
        method: "meta_tag",
      });

      expect(result).toEqual(step1State);
    });
  });

  describe("step 2 actions", () => {
    const step2State = createInitialState({
      id: "td_123",
      domainName: "example.com",
      verificationToken: "token_abc",
      verificationMethod: "dns_txt",
    });

    it("SET_METHOD updates verification method", () => {
      const result = verificationReducer(step2State, {
        type: "SET_METHOD",
        method: "meta_tag",
      });

      if (result.step === 2) {
        expect(result.method).toBe("meta_tag");
      }
    });

    it("START_VERIFICATION sets verifying status", () => {
      const result = verificationReducer(step2State, {
        type: "START_VERIFICATION",
      });

      if (result.step === 2) {
        expect(result.verifyStatus).toBe("verifying");
        expect(result.verifyError).toBeUndefined();
      }
    });

    it("START_VERIFICATION clears previous error", () => {
      const stateWithError = {
        ...step2State,
        verifyStatus: "failed" as const,
        verifyError: "Previous error",
      };

      const result = verificationReducer(stateWithError, {
        type: "START_VERIFICATION",
      });

      if (result.step === 2) {
        expect(result.verifyStatus).toBe("verifying");
        expect(result.verifyError).toBeUndefined();
      }
    });

    it("VERIFICATION_SUCCEEDED transitions to step 3", () => {
      const result = verificationReducer(step2State, {
        type: "VERIFICATION_SUCCEEDED",
        method: "dns_txt",
      });

      expect(result).toEqual({
        step: 3,
        domain: "example.com",
        trackedDomainId: "td_123",
      });
    });

    it("VERIFICATION_FAILED sets failed status with error", () => {
      const result = verificationReducer(step2State, {
        type: "VERIFICATION_FAILED",
        error: "Token not found",
      });

      if (result.step === 2) {
        expect(result.verifyStatus).toBe("failed");
        expect(result.verifyError).toBe("Token not found");
      }
    });

    it("VERIFICATION_FAILED works without error message", () => {
      const result = verificationReducer(step2State, {
        type: "VERIFICATION_FAILED",
      });

      if (result.step === 2) {
        expect(result.verifyStatus).toBe("failed");
        expect(result.verifyError).toBeUndefined();
      }
    });

    it("GO_BACK returns to step 1 preserving domain", () => {
      const result = verificationReducer(step2State, { type: "GO_BACK" });

      expect(result).toEqual({
        step: 1,
        domain: "example.com",
        domainError: "",
        hasAttemptedSubmit: false,
      });
    });

    it("SYNC_VERIFICATION_DATA updates partial data", () => {
      const result = verificationReducer(step2State, {
        type: "SYNC_VERIFICATION_DATA",
        verificationToken: "new_token",
      });

      if (result.step === 2) {
        expect(result.verificationToken).toBe("new_token");
        expect(result.domain).toBe("example.com");
        expect(result.method).toBe("dns_txt");
      }
    });

    it("SYNC_VERIFICATION_DATA can update all fields", () => {
      const result = verificationReducer(step2State, {
        type: "SYNC_VERIFICATION_DATA",
        domain: "updated.com",
        verificationToken: "new_token",
        method: "meta_tag",
      });

      if (result.step === 2) {
        expect(result.domain).toBe("updated.com");
        expect(result.verificationToken).toBe("new_token");
        expect(result.method).toBe("meta_tag");
      }
    });

    it("ignores step 1 actions when on step 2", () => {
      const result = verificationReducer(step2State, {
        type: "SET_DOMAIN",
        domain: "other.com",
      });

      expect(result).toEqual(step2State);
    });
  });

  describe("navigation actions", () => {
    it("RESET returns to step 1 with empty domain", () => {
      const step2State = createInitialState({
        id: "td_123",
        domainName: "example.com",
        verificationToken: "token_abc",
        verificationMethod: "dns_txt",
      });

      const result = verificationReducer(step2State, { type: "RESET" });

      expect(result).toEqual({
        step: 1,
        domain: "",
        domainError: "",
        hasAttemptedSubmit: false,
      });
    });

    it("RESET can prefill domain", () => {
      const step2State = createInitialState({
        id: "td_123",
        domainName: "example.com",
        verificationToken: "token_abc",
        verificationMethod: "dns_txt",
      });

      const result = verificationReducer(step2State, {
        type: "RESET",
        prefillDomain: "prefilled.com",
      });

      if (result.step === 1) {
        expect(result.domain).toBe("prefilled.com");
      }
    });

    it("RESUME transitions to step 2 from step 1", () => {
      const step1State = createInitialState();

      const result = verificationReducer(step1State, {
        type: "RESUME",
        data: {
          id: "td_456",
          domainName: "resumed.com",
          verificationToken: "token_xyz",
          verificationMethod: "meta_tag",
        },
      });

      expect(result).toEqual({
        step: 2,
        domain: "resumed.com",
        trackedDomainId: "td_456",
        verificationToken: "token_xyz",
        method: "meta_tag",
        verifyStatus: "idle",
      });
    });

    it("RESUME can override existing step 2 state", () => {
      const step2State = createInitialState({
        id: "td_123",
        domainName: "old.com",
        verificationToken: "old_token",
        verificationMethod: "dns_txt",
      });

      const result = verificationReducer(step2State, {
        type: "RESUME",
        data: {
          id: "td_456",
          domainName: "new.com",
          verificationToken: "new_token",
          verificationMethod: "meta_tag",
        },
      });

      if (result.step === 2) {
        expect(result.trackedDomainId).toBe("td_456");
        expect(result.domain).toBe("new.com");
      }
    });

    it("RESUME defaults to dns_txt when method is null", () => {
      const step1State = createInitialState();

      const result = verificationReducer(step1State, {
        type: "RESUME",
        data: {
          id: "td_456",
          domainName: "resumed.com",
          verificationToken: "token_xyz",
          verificationMethod: null,
        },
      });

      if (result.step === 2) {
        expect(result.method).toBe("dns_txt");
      }
    });
  });

  describe("step 3 state", () => {
    it("is terminal - most actions are no-ops", () => {
      const step3State = {
        step: 3 as const,
        domain: "example.com",
        trackedDomainId: "td_123",
      };

      // These should all return the same state
      expect(
        verificationReducer(step3State, {
          type: "SET_DOMAIN",
          domain: "x.com",
        }),
      ).toEqual(step3State);
      expect(
        verificationReducer(step3State, {
          type: "SET_METHOD",
          method: "meta_tag",
        }),
      ).toEqual(step3State);
      expect(verificationReducer(step3State, { type: "GO_BACK" })).toEqual(
        step3State,
      );
    });

    it("RESET can exit step 3", () => {
      const step3State = {
        step: 3 as const,
        domain: "example.com",
        trackedDomainId: "td_123",
      };

      const result = verificationReducer(step3State, { type: "RESET" });
      expect(result.step).toBe(1);
    });

    it("RESUME can exit step 3", () => {
      const step3State = {
        step: 3 as const,
        domain: "example.com",
        trackedDomainId: "td_123",
      };

      const result = verificationReducer(step3State, {
        type: "RESUME",
        data: {
          id: "td_456",
          domainName: "new.com",
          verificationToken: "token",
          verificationMethod: "dns_txt",
        },
      });

      expect(result.step).toBe(2);
    });
  });
});
