import type { ResumeDomainData } from "@domainstack/types";

/**
 * Unified state for the domain verification flow.
 * Using a discriminated union on `step` makes invalid states unrepresentable.
 *
 * Token / method / verify status for resume-with-incomplete-data are read from
 * React Query, not stored here.
 */
type VerificationStep1 = {
  step: 1;
  domain: string;
  domainError: string;
};

type VerificationStep2 = {
  step: 2;
  domain: string;
  trackedDomainId: string;
  verificationToken: string;
};

type VerificationStep3 = {
  step: 3;
  domain: string;
  trackedDomainId: string;
};

export type VerificationFlowState = VerificationStep1 | VerificationStep2 | VerificationStep3;

export function toStep1(domain = ""): VerificationStep1 {
  return {
    step: 1,
    domain,
    domainError: "",
  };
}

export function toStep2(
  domain: string,
  trackedDomainId: string,
  verificationToken: string,
): VerificationStep2 {
  return {
    step: 2,
    domain,
    trackedDomainId,
    verificationToken,
  };
}

export function toStep3(state: VerificationStep2): VerificationStep3 {
  return {
    step: 3,
    domain: state.domain,
    trackedDomainId: state.trackedDomainId,
  };
}

export function createInitialState(
  resumeDomain?: ResumeDomainData | null,
  prefillDomain?: string,
): VerificationFlowState {
  if (resumeDomain) {
    return toStep2(resumeDomain.domainName, resumeDomain.id, resumeDomain.verificationToken);
  }

  return toStep1(prefillDomain ?? "");
}
