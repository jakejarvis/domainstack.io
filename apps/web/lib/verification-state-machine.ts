import type { VerificationMethod } from "@/lib/constants/verification";
import type { ResumeDomainData } from "@/lib/types/verification";

// ============================================================================
// State Types
// ============================================================================

/**
 * Unified state for the domain verification flow.
 * Using a discriminated union on `step` makes invalid states unrepresentable.
 *
 * State Transitions:
 * ```
 *   ┌─────────────┐
 *   │  Step 1     │ ─── DOMAIN_ADDED ───► Step 2
 *   │ Enter domain│ ◄─── GO_BACK ────────┘
 *   └─────────────┘
 *         │
 *       RESET
 *         │
 *         ▼
 *   ┌─────────────┐
 *   │  Step 2     │ ─── VERIFICATION_SUCCEEDED ───► Step 3
 *   │   Verify    │
 *   └─────────────┘
 *         ▲
 *         │
 *       RESUME (from any step)
 * ```
 */
export type VerificationFlowState =
  | {
      step: 1; // Enter domain
      domain: string;
      domainError: string;
      hasAttemptedSubmit: boolean;
    }
  | {
      step: 2; // Verify ownership
      domain: string;
      trackedDomainId: string;
      verificationToken: string;
      method: VerificationMethod;
      verifyStatus: "idle" | "verifying" | "failed";
      verifyError?: string;
    }
  | {
      step: 3; // Success
      domain: string;
      trackedDomainId: string;
    };

// ============================================================================
// Action Types
// ============================================================================

export type VerificationAction =
  // Step 1 actions
  | { type: "SET_DOMAIN"; domain: string }
  | { type: "SET_DOMAIN_ERROR"; error: string }
  | { type: "ATTEMPT_SUBMIT" }
  // Step 1 → Step 2 transition
  | {
      type: "DOMAIN_ADDED";
      trackedDomainId: string;
      verificationToken: string;
      resumed?: boolean;
    }
  // Step 2 actions
  | { type: "SET_METHOD"; method: VerificationMethod }
  | { type: "START_VERIFICATION" }
  | { type: "VERIFICATION_FAILED"; error?: string }
  // Step 2 → Step 3 transition
  | { type: "VERIFICATION_SUCCEEDED"; method: VerificationMethod | null }
  // Navigation
  | { type: "GO_BACK" }
  | { type: "RESET"; prefillDomain?: string }
  // External sync
  | { type: "RESUME"; data: ResumeDomainData }
  | {
      type: "SYNC_VERIFICATION_DATA";
      domain?: string;
      verificationToken?: string;
      method?: VerificationMethod;
    };

// ============================================================================
// Initial State Factory
// ============================================================================

export function createInitialState(
  resumeDomain?: ResumeDomainData | null,
  prefillDomain?: string,
): VerificationFlowState {
  if (resumeDomain) {
    return {
      step: 2,
      domain: resumeDomain.domainName,
      trackedDomainId: resumeDomain.id,
      verificationToken: resumeDomain.verificationToken,
      method: resumeDomain.verificationMethod ?? "dns_txt",
      verifyStatus: "idle",
    };
  }

  return {
    step: 1,
    domain: prefillDomain ?? "",
    domainError: "",
    hasAttemptedSubmit: false,
  };
}

// ============================================================================
// Reducer
// ============================================================================

export function verificationReducer(
  state: VerificationFlowState,
  action: VerificationAction,
): VerificationFlowState {
  switch (action.type) {
    case "SET_DOMAIN":
      if (state.step !== 1) return state;
      return {
        ...state,
        domain: action.domain,
        // Clear error when user edits
        domainError: state.domainError ? "" : state.domainError,
      };

    case "SET_DOMAIN_ERROR":
      if (state.step !== 1) return state;
      return { ...state, domainError: action.error };

    case "ATTEMPT_SUBMIT":
      if (state.step !== 1) return state;
      return { ...state, hasAttemptedSubmit: true, domainError: "" };

    case "DOMAIN_ADDED":
      if (state.step !== 1) return state;
      return {
        step: 2,
        domain: state.domain,
        trackedDomainId: action.trackedDomainId,
        verificationToken: action.verificationToken,
        method: "dns_txt",
        verifyStatus: "idle",
      };

    case "SET_METHOD":
      if (state.step !== 2) return state;
      return { ...state, method: action.method };

    case "START_VERIFICATION":
      if (state.step !== 2) return state;
      return { ...state, verifyStatus: "verifying", verifyError: undefined };

    case "VERIFICATION_SUCCEEDED":
      if (state.step !== 2) return state;
      return {
        step: 3,
        domain: state.domain,
        trackedDomainId: state.trackedDomainId,
      };

    case "VERIFICATION_FAILED":
      if (state.step !== 2) return state;
      return {
        ...state,
        verifyStatus: "failed",
        verifyError: action.error,
      };

    case "GO_BACK":
      if (state.step !== 2) return state;
      return {
        step: 1,
        domain: state.domain,
        domainError: "",
        hasAttemptedSubmit: false,
      };

    case "RESET":
      return {
        step: 1,
        domain: action.prefillDomain ?? "",
        domainError: "",
        hasAttemptedSubmit: false,
      };

    case "RESUME":
      // Allow resuming from any step
      return {
        step: 2,
        domain: action.data.domainName,
        trackedDomainId: action.data.id,
        verificationToken: action.data.verificationToken,
        method: action.data.verificationMethod ?? "dns_txt",
        verifyStatus: "idle",
      };

    case "SYNC_VERIFICATION_DATA":
      if (state.step !== 2) return state;
      return {
        ...state,
        domain: action.domain ?? state.domain,
        verificationToken: action.verificationToken ?? state.verificationToken,
        method: action.method ?? state.method,
      };

    default:
      return state;
  }
}
