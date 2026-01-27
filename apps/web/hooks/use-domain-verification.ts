import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { toast } from "sonner";
import { analytics } from "@/lib/analytics/client";
import type { VerificationMethod } from "@/lib/constants/verification";
import { isValidDomain, normalizeDomainInput } from "@/lib/domain-utils";
import { useTRPC } from "@/lib/trpc/client";
import type { ResumeDomainData } from "@/lib/types/verification";
import {
  createInitialState,
  verificationReducer,
} from "@/lib/verification-state";

// ============================================================================
// Types
// ============================================================================

interface UseDomainVerificationOptions {
  /** Whether the verification flow is open/visible (default: true for page usage) */
  open?: boolean;
  /** Handler when the flow should close (required for dialog, optional for page) */
  onOpenChange?: (open: boolean) => void;
  onSuccess: () => void;
  resumeDomain?: ResumeDomainData | null;
  /** Pre-fill the domain input (e.g., from domain report "Track" button) */
  prefillDomain?: string;
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

  // Store callback in ref to avoid re-creating handleVerify when onSuccess changes
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

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

  // Extract primitives for effect dependencies (avoids re-running on unrelated state changes)
  const currentStep = state.step;
  const currentTrackedDomainId =
    state.step === 2 || state.step === 3 ? state.trackedDomainId : null;

  // Track the previous resumeDomain ID to detect when resuming ends
  const prevResumeDomainIdRef = useRef(resumeDomain?.id);

  // Sync when resumeDomain prop changes (e.g., TrackDomainButton switches modes)
  useEffect(() => {
    const wasResuming = !!prevResumeDomainIdRef.current;
    const isNowResuming = !!resumeDomain;

    if (resumeDomain && open) {
      // Skip if we're already tracking this exact domain
      if (currentStep === 2 && currentTrackedDomainId === resumeDomain.id) {
        prevResumeDomainIdRef.current = resumeDomain.id;
        return;
      }
      dispatch({ type: "RESUME", data: resumeDomain });
    } else if (wasResuming && !isNowResuming) {
      // Reset when resumeDomain is cleared (e.g., navigating from resume mode to fresh add)
      dispatch({ type: "RESET", prefillDomain });
    }

    prevResumeDomainIdRef.current = resumeDomain?.id;
  }, [resumeDomain, open, currentStep, currentTrackedDomainId, prefillDomain]);

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
  const currentDomain = state.domain;
  useEffect(() => {
    if (
      !resumeDomain &&
      prefillDomain !== undefined &&
      currentStep === 1 &&
      currentDomain !== prefillDomain
    ) {
      dispatch({ type: "SET_DOMAIN", domain: prefillDomain });
    }
  }, [prefillDomain, resumeDomain, currentStep, currentDomain]);

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
        onSuccessRef.current();
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
  }, [state, verifyDomainMutation]);

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
  // Derived State
  // ============================================================================

  // Query-related derived state
  const isPrefilled = !!prefillDomain && !isResuming;
  const isLoadingVerificationData =
    isResuming && verificationDataQuery.isLoading;
  const isVerificationDataQueryError =
    isResuming && verificationDataQuery.isError;

  // Step-specific derived state (type-narrowed from discriminated union)
  const domainError = state.step === 1 ? state.domainError : "";
  const hasAttemptedDomainSubmit =
    state.step === 1 ? state.hasAttemptedSubmit : false;
  const trackedDomainIdDerived =
    state.step === 2 || state.step === 3 ? state.trackedDomainId : null;
  const verificationTokenDerived =
    state.step === 2 ? state.verificationToken : "";
  const method: VerificationMethod =
    state.step === 2 ? state.method : "dns_txt";

  // Verification status (step 2 only)
  const isVerifying = state.step === 2 && state.verifyStatus === "verifying";
  const hasFailed = state.step === 2 && state.verifyStatus === "failed";
  const verificationError = state.step === 2 ? state.verifyError : undefined;
  const isMissingVerificationData =
    state.step === 2 && !isLoadingVerificationData && !state.verificationToken;

  // Verification state object for consumers
  const verificationState = useMemo(() => {
    if (hasFailed)
      return { status: "failed", error: verificationError } as const;
    if (isVerifying) return { status: "verifying" } as const;
    return { status: "idle" } as const;
  }, [hasFailed, isVerifying, verificationError]);

  // Can proceed to next step?
  const canProceed = useMemo(() => {
    if (state.step === 1) {
      const normalized = normalizeDomainInput(state.domain);
      return isValidDomain(normalized) && !addDomainMutation.isPending;
    }
    if (state.step === 2) {
      return state.verifyStatus !== "verifying";
    }
    return true;
  }, [state, addDomainMutation.isPending]);

  // ============================================================================
  // Return API (maintains backward compatibility)
  // ============================================================================

  return {
    // State
    step: state.step,
    domain: state.domain,
    setDomain,
    domainError,
    method,
    setMethod,
    verificationToken: verificationTokenDerived,
    verificationState,
    hasAttemptedDomainSubmit,
    trackedDomainId: trackedDomainIdDerived,

    // Handlers
    handleOpenChange,
    handleNext,
    handleVerify,
    handleReturnLater,
    goBack,
    canProceed,
    refetchVerificationData: verificationDataQuery.refetch,

    // Query/mutation state
    isAddingDomain: addDomainMutation.isPending,
    isRefetchingVerificationData: verificationDataQuery.isFetching,
    verificationDataErrorMessage: verificationDataQuery.error?.message,

    // Derived state
    isResuming,
    isPrefilled,
    isLoadingVerificationData,
    isVerificationDataQueryError,
    isMissingVerificationData,
    isVerifying,
    hasFailed,
  };
}
