import type { VerificationMethod } from "@domainstack/constants";

export type AddDomainFlowState =
  | { status: "idle"; domain: "" }
  | { status: "editing"; domain: string }
  | { status: "submitting"; domain: string }
  | {
      status: "instructions";
      domain: string;
      trackedDomainId: string;
      token: string;
      method: VerificationMethod;
    }
  | {
      status: "verifying";
      domain: string;
      trackedDomainId: string;
      token: string;
      method: VerificationMethod;
    }
  | { status: "verified"; domain: string; trackedDomainId: string }
  | {
      status: "failed";
      domain: string;
      trackedDomainId?: string;
      token?: string;
      method?: VerificationMethod;
      message: string;
    };

export type AddDomainFlowEvent =
  | { type: "edit"; domain: string }
  | { type: "submit" }
  | { type: "instructions"; trackedDomainId: string; token: string; method?: VerificationMethod }
  | { type: "setMethod"; method: VerificationMethod }
  | { type: "verify" }
  | { type: "verified" }
  | { type: "fail"; message: string };

export function reduceAddDomainFlow(
  state: AddDomainFlowState,
  event: AddDomainFlowEvent,
): AddDomainFlowState {
  switch (event.type) {
    case "edit":
      return event.domain
        ? { status: "editing", domain: event.domain }
        : { status: "idle", domain: "" };
    case "submit":
      return state.domain ? { status: "submitting", domain: state.domain } : state;
    case "instructions":
      if (state.status !== "submitting") return state;
      return {
        status: "instructions",
        domain: state.domain,
        trackedDomainId: event.trackedDomainId,
        token: event.token,
        method: event.method ?? "dns_txt",
      };
    case "setMethod":
      if (state.status === "instructions" || state.status === "verifying") {
        return { ...state, method: event.method };
      }
      if (state.status === "failed" && state.trackedDomainId && state.token) {
        return { ...state, method: event.method };
      }
      return state;
    case "verify":
      if (state.status !== "instructions" && state.status !== "failed") return state;
      if (!state.trackedDomainId || !state.token) return state;
      return {
        status: "verifying",
        domain: state.domain,
        trackedDomainId: state.trackedDomainId,
        token: state.token,
        method: state.method ?? "dns_txt",
      };
    case "verified":
      if (state.status !== "verifying") return state;
      return {
        status: "verified",
        domain: state.domain,
        trackedDomainId: state.trackedDomainId,
      };
    case "fail":
      return {
        status: "failed",
        domain: state.domain,
        message: event.message,
        trackedDomainId: "trackedDomainId" in state ? state.trackedDomainId : undefined,
        token: "token" in state ? state.token : undefined,
        method: "method" in state ? state.method : undefined,
      };
  }
}
