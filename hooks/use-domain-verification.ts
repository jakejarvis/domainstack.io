import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useReducer } from "react";
import { toast } from "sonner";
import { analytics } from "@/lib/analytics/client";
import { isValidDomain, normalizeDomainInput } from "@/lib/domain";
import { useTRPC } from "@/lib/trpc/client";
import type { ResumeDomainData, VerificationMethod } from "@/lib/types";

// ============================================================================
// Types
// ============================================================================

type UseDomainVerificationOptions = {
  /** Whether the verification flow is open/visible (default: true for page usage) */
  open?: boolean;
  /** Handler when the flow should close (required for dialog, optional for page) */
  onOpenChange?: (open: boolean) => void;
  onSuccess: () => void;
  resumeDomain?: ResumeDomainData | null;
  /** Pre-fill the domain input (e.g., from domain report "Track" button) */
  prefillDomain?: string;
};

// ============================================================================
// State Machine
// ============================================================================

/**
 * Unified state for the domain verification flow.
 * Using a discriminated union on `step` makes invalid states unrepresentable.
 */
type VerificationFlowState =
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

type VerificationAction =
  | { type: "SET_DOMAIN"; domain: string }
  | { type: "SET_DOMAIN_ERROR"; error: string }
  | { type: "ATTEMPT_SUBMIT" }
  | {
      type: "DOMAIN_ADDED";
      trackedDomainId: string;
      verificationToken: string;
      resumed?: boolean;
    }
  | { type: "SET_METHOD"; method: VerificationMethod }
  | { type: "START_VERIFICATION" }
  | { type: "VERIFICATION_SUCCEEDED"; method: VerificationMethod | null }
  | { type: "VERIFICATION_FAILED"; error?: string }
  | { type: "GO_BACK" }
  | { type: "RESET"; prefillDomain?: string }
  | {
      type: "RESUME";
      data: ResumeDomainData;
    }
  | {
      type: "SYNC_VERIFICATION_DATA";
      domain?: string;
      verificationToken?: string;
      method?: VerificationMethod;
    };

function createInitialState(
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

function verificationReducer(
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

// ============================================================================
// Hook
// ============================================================================

export function useDomainVerification({
  open = true,
  onOpenChange,
  onSuccess,
  resumeDomain,
  prefillDomain,
}: UseDomainVerificationOptions) {
  const [state, dispatch] = useReducer(
    verificationReducer,
    { resumeDomain, prefillDomain },
    ({ resumeDomain, prefillDomain }) =>
      createInitialState(resumeDomain, prefillDomain),
  );

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // ============================================================================
  // Mutations & Queries
  // ============================================================================

  const invalidateQueries = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.tracking.listDomains.queryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: trpc.user.getSubscription.queryKey(),
    });
  }, [queryClient, trpc]);

  const addDomainMutation = useMutation({
    ...trpc.tracking.addDomain.mutationOptions(),
    onSettled: invalidateQueries,
  });

  const verifyDomainMutation = useMutation({
    ...trpc.tracking.verifyDomain.mutationOptions(),
    onSettled: invalidateQueries,
  });

  // Fetch verification data when resuming with incomplete data
  const trackedDomainId = state.step === 2 ? state.trackedDomainId : null;
  const verificationToken = state.step === 2 ? state.verificationToken : "";
  const isResuming = !!resumeDomain;

  const verificationDataQuery = useQuery({
    ...trpc.tracking.getVerificationData.queryOptions({
      trackedDomainId: trackedDomainId ?? "",
    }),
    enabled:
      !!trackedDomainId &&
      open &&
      isResuming &&
      (!verificationToken || !state.domain.trim().length),
  });

  // ============================================================================
  // Effects for External State Sync
  // ============================================================================

  // Sync when resumeDomain prop changes (e.g., TrackDomainButton switches modes)
  useEffect(() => {
    if (resumeDomain && open) {
      // Skip if we're already tracking this exact domain
      if (state.step === 2 && state.trackedDomainId === resumeDomain.id) {
        return;
      }
      dispatch({ type: "RESUME", data: resumeDomain });
    }
  }, [resumeDomain, open, state]);

  // Sync when verification data query returns
  useEffect(() => {
    if (verificationDataQuery.data) {
      const { domain, verificationToken, verificationMethod } =
        verificationDataQuery.data;
      dispatch({
        type: "SYNC_VERIFICATION_DATA",
        domain: domain ?? undefined,
        verificationToken: verificationToken ?? undefined,
        method: verificationMethod ?? undefined,
      });
    }
  }, [verificationDataQuery.data]);

  // Sync prefillDomain when it changes (and we're not resuming)
  useEffect(() => {
    if (
      !resumeDomain &&
      prefillDomain !== undefined &&
      state.step === 1 &&
      state.domain !== prefillDomain
    ) {
      dispatch({ type: "SET_DOMAIN", domain: prefillDomain });
    }
  }, [prefillDomain, resumeDomain, state]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const setDomain = useCallback((value: string) => {
    dispatch({ type: "SET_DOMAIN", domain: value });
  }, []);

  const setMethod = useCallback((method: VerificationMethod) => {
    dispatch({ type: "SET_METHOD", method });
  }, []);

  const resetDialog = useCallback(() => {
    dispatch({ type: "RESET", prefillDomain });
  }, [prefillDomain]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        resetDialog();
      }
      onOpenChange?.(open);
    },
    [onOpenChange, resetDialog],
  );

  const handleAddDomain = useCallback(async () => {
    if (state.step !== 1) return;

    dispatch({ type: "ATTEMPT_SUBMIT" });

    const normalized = normalizeDomainInput(state.domain);
    if (!isValidDomain(normalized)) {
      dispatch({
        type: "SET_DOMAIN_ERROR",
        error: "Please enter a valid domain",
      });
      return;
    }

    try {
      const result = await addDomainMutation.mutateAsync({
        domain: state.domain,
      });

      dispatch({
        type: "DOMAIN_ADDED",
        trackedDomainId: result.id,
        verificationToken: result.verificationToken,
        resumed: result.resumed,
      });

      if (result.resumed) {
        toast.info("Resuming verification", {
          description:
            "You previously started tracking this domain. Your verification token is unchanged.",
        });
      }
    } catch (err) {
      dispatch({
        type: "SET_DOMAIN_ERROR",
        error: err instanceof Error ? err.message : "Failed to add domain",
      });
    }
  }, [state, addDomainMutation]);

  const handleVerify = useCallback(async () => {
    if (state.step !== 2) return;

    dispatch({ type: "START_VERIFICATION" });

    try {
      const result = await verifyDomainMutation.mutateAsync({
        trackedDomainId: state.trackedDomainId,
      });

      if (result.verified) {
        dispatch({ type: "VERIFICATION_SUCCEEDED", method: result.method });
        toast.success("Domain verified successfully!");
        analytics.track("domain_verification_succeeded", {
          domain: state.domain,
          method: result.method,
        });
        onSuccess();
      } else {
        dispatch({ type: "VERIFICATION_FAILED" });
        analytics.track("domain_verification_failed", {
          domain: state.domain,
        });
      }
    } catch {
      dispatch({
        type: "VERIFICATION_FAILED",
        error: "Something went wrong. Please try again.",
      });
      analytics.track("domain_verification_failed", {
        domain: state.domain,
        error: "exception",
      });
    }
  }, [state, verifyDomainMutation, onSuccess]);

  const handleReturnLater = useCallback(() => {
    toast.info("Domain saved", {
      description:
        "We'll automatically verify your domain once the changes have propagated. Check back later!",
    });
    handleOpenChange(false);
  }, [handleOpenChange]);

  const handleDone = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  const goBack = useCallback(() => {
    dispatch({ type: "GO_BACK" });
  }, []);

  const handleNext = useCallback(async () => {
    switch (state.step) {
      case 1:
        await handleAddDomain();
        break;
      case 2:
        await handleVerify();
        break;
      case 3:
        handleDone();
        break;
    }
  }, [state.step, handleAddDomain, handleVerify, handleDone]);

  // ============================================================================
  // Derived State (Memoized)
  // ============================================================================

  const derived = useMemo(() => {
    const isPrefilled = !!prefillDomain && !isResuming;
    const isLoadingVerificationData =
      isResuming && verificationDataQuery.isLoading;
    const isVerificationDataQueryError =
      isResuming && verificationDataQuery.isError;

    // Step-specific derived state
    const domainError = state.step === 1 ? state.domainError : "";
    const hasAttemptedDomainSubmit =
      state.step === 1 ? state.hasAttemptedSubmit : false;
    const currentTrackedDomainId =
      state.step === 2 || state.step === 3 ? state.trackedDomainId : null;
    const currentVerificationToken =
      state.step === 2 ? state.verificationToken : "";
    const method: VerificationMethod =
      state.step === 2 ? state.method : "dns_txt";
    const isMissingVerificationData =
      state.step === 2 &&
      !isLoadingVerificationData &&
      !state.verificationToken;
    const isVerifying = state.step === 2 && state.verifyStatus === "verifying";
    const hasFailed = state.step === 2 && state.verifyStatus === "failed";
    const verificationError = state.step === 2 ? state.verifyError : undefined;

    // Can proceed logic
    let canProceedValue = false;
    if (state.step === 1) {
      const normalized = normalizeDomainInput(state.domain);
      canProceedValue =
        isValidDomain(normalized) && !addDomainMutation.isPending;
    } else if (state.step === 2) {
      canProceedValue = state.verifyStatus !== "verifying";
    } else {
      canProceedValue = true;
    }

    return {
      isPrefilled,
      isLoadingVerificationData,
      isVerificationDataQueryError,
      domainError,
      hasAttemptedDomainSubmit,
      trackedDomainId: currentTrackedDomainId,
      verificationToken: currentVerificationToken,
      method,
      isMissingVerificationData,
      isVerifying,
      hasFailed,
      verificationState: hasFailed
        ? ({ status: "failed", error: verificationError } as const)
        : isVerifying
          ? ({ status: "verifying" } as const)
          : ({ status: "idle" } as const),
      canProceedValue,
    };
  }, [
    state,
    prefillDomain,
    isResuming,
    verificationDataQuery.isLoading,
    verificationDataQuery.isError,
    addDomainMutation.isPending,
  ]);

  // ============================================================================
  // Return API (maintains backward compatibility)
  // ============================================================================

  return {
    // State
    step: state.step,
    domain: state.domain,
    setDomain,
    domainError: derived.domainError,
    method: derived.method,
    setMethod,
    verificationToken: derived.verificationToken,
    verificationState: derived.verificationState,
    hasAttemptedDomainSubmit: derived.hasAttemptedDomainSubmit,
    trackedDomainId: derived.trackedDomainId,

    // Handlers
    handleOpenChange,
    handleNext,
    handleVerify,
    handleReturnLater,
    goBack,
    canProceed: derived.canProceedValue,
    refetchVerificationData: verificationDataQuery.refetch,

    // Query/mutation state
    isAddingDomain: addDomainMutation.isPending,
    isRefetchingVerificationData: verificationDataQuery.isFetching,
    verificationDataErrorMessage: verificationDataQuery.error?.message,

    // Derived state
    isResuming,
    isPrefilled: derived.isPrefilled,
    isLoadingVerificationData: derived.isLoadingVerificationData,
    isVerificationDataQueryError: derived.isVerificationDataQueryError,
    isMissingVerificationData: derived.isMissingVerificationData,
    isVerifying: derived.isVerifying,
    hasFailed: derived.hasFailed,
  };
}
