"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { analytics } from "@/lib/analytics/client";
import { isValidDomain, normalizeDomainInput } from "@/lib/domain";
import { logger } from "@/lib/logger/client";
import type {
  VerificationInstructions,
  VerificationMethod,
} from "@/lib/schemas";
import { useTRPC } from "@/lib/trpc/client";

export type ResumeDomainData = {
  id: string;
  domainName: string;
  verificationToken: string;
};

export type VerificationState =
  | { status: "idle" }
  | { status: "verifying" }
  | { status: "failed"; error?: string };

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

export function useDomainVerification({
  open = true,
  onOpenChange,
  onSuccess,
  resumeDomain,
  prefillDomain,
}: UseDomainVerificationOptions) {
  // Determine initial state based on resumeDomain (takes priority) or prefillDomain
  const initialDomain = resumeDomain?.domainName ?? prefillDomain ?? "";
  const initialStep = resumeDomain ? 2 : 1;
  const initialTrackedDomainId = resumeDomain?.id ?? null;

  const [step, setStep] = useState(initialStep);
  const [domain, setDomain] = useState(initialDomain);
  const [domainError, setDomainError] = useState("");
  const [method, setMethod] = useState<VerificationMethod>("dns_txt");
  const [trackedDomainId, setTrackedDomainId] = useState<string | null>(
    initialTrackedDomainId,
  );
  const [instructions, setInstructions] =
    useState<VerificationInstructions | null>(null);
  const [verificationState, setVerificationState] = useState<VerificationState>(
    { status: "idle" },
  );
  const [hasAttemptedDomainSubmit, setHasAttemptedDomainSubmit] =
    useState(false);

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Query keys for invalidation - use partial matching to catch infinite queries
  const domainsQueryKey = trpc.tracking.listDomains.queryKey();
  const limitsQueryKey = trpc.tracking.getLimits.queryKey();

  const addDomainMutation = useMutation({
    ...trpc.tracking.addDomain.mutationOptions(),
    onSuccess: () => {
      // Invalidate queries immediately so the domain appears in the list
      // (even if user closes dialog before completing verification)
      // Use exact: false to match all listDomains queries including infinite queries with different inputs
      void queryClient.invalidateQueries({
        queryKey: domainsQueryKey,
        exact: false,
      });
      void queryClient.invalidateQueries({ queryKey: limitsQueryKey });
    },
  });

  const verifyDomainMutation = useMutation(
    trpc.tracking.verifyDomain.mutationOptions(),
  );

  // Fetch instructions when resuming verification (keyed on trackedDomainId for safety)
  const instructionsQuery = useQuery({
    ...trpc.tracking.getVerificationInstructions.queryOptions({
      trackedDomainId: trackedDomainId ?? "",
    }),
    enabled: !!trackedDomainId && open,
  });

  // When resumeDomain changes, update the state accordingly
  // This handles the case when TrackDomainButton switches from prefill to resume mode
  useEffect(() => {
    if (resumeDomain && open) {
      setDomain(resumeDomain.domainName);
      setTrackedDomainId(resumeDomain.id);
      setStep(2);
      // Reset state that could be stale from a previous domain
      setVerificationState({ status: "idle" });
      setDomainError("");
      setMethod("dns_txt");
      setInstructions(null); // Will be set by instructionsQuery effect
    }
  }, [resumeDomain, open]);

  // When instructions are fetched (resume mode), set them
  useEffect(() => {
    if (instructionsQuery.data) {
      setInstructions(instructionsQuery.data);
    }
  }, [instructionsQuery.data]);

  // Sync domain state when prefillDomain changes and no resumeDomain is active
  // This ensures the domain field is updated when props change
  useEffect(() => {
    if (!resumeDomain && prefillDomain !== undefined && !trackedDomainId) {
      setDomain(prefillDomain);
    }
  }, [prefillDomain, resumeDomain, trackedDomainId]);

  // Clear domain error when user edits the domain input
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally run when domain changes to clear stale errors
  useEffect(() => {
    if (domainError) {
      setDomainError("");
    }
  }, [domain]);

  const resetDialog = useCallback(() => {
    setStep(1);
    setDomain(prefillDomain ?? "");
    setDomainError("");
    setMethod("dns_txt");
    setTrackedDomainId(null);
    setInstructions(null);
    setVerificationState({ status: "idle" });
    setHasAttemptedDomainSubmit(false);
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
    setDomainError("");
    setHasAttemptedDomainSubmit(true);

    // Client-side validation - don't hit the server if domain is invalid
    const normalized = normalizeDomainInput(domain);
    if (!isValidDomain(normalized)) {
      return;
    }

    try {
      const result = await addDomainMutation.mutateAsync({ domain });
      setTrackedDomainId(result.id);
      setInstructions(result.instructions);
      setStep(2);

      // Let user know if they're resuming a previous verification attempt
      if (result.resumed) {
        toast.info("Resuming verification", {
          description:
            "You previously started tracking this domain. Your verification token is unchanged.",
        });
      }
    } catch (err) {
      if (err instanceof Error) {
        setDomainError(err.message);
      } else {
        setDomainError("Failed to add domain");
      }
    }
  }, [domain, addDomainMutation]);

  const handleVerify = useCallback(async () => {
    if (!trackedDomainId) return;

    setVerificationState({ status: "verifying" });

    try {
      // Try all verification methods - user may have set up a different method
      // than the tab they're currently viewing
      const result = await verifyDomainMutation.mutateAsync({
        trackedDomainId,
      });

      if (result.verified) {
        setVerificationState({ status: "idle" });
        setStep(3);
        toast.success("Domain verified successfully!");
        analytics.track("domain_verification_succeeded", {
          domain,
          method: result.method,
        });
        // Invalidate queries so the dashboard shows the updated verified status
        // Use exact: false to match all listDomains queries including infinite queries
        void queryClient.invalidateQueries({
          queryKey: domainsQueryKey,
          exact: false,
        });
        void queryClient.invalidateQueries({ queryKey: limitsQueryKey });
      } else {
        setVerificationState({
          status: "failed",
          error: result.error,
        });
        analytics.track("domain_verification_failed", {
          domain,
          error: result.error,
        });
      }
    } catch (err) {
      logger.error("Domain verification failed", err, {
        trackedDomainId,
        method,
      });
      setVerificationState({
        status: "failed",
        error: "Verification failed. Please try again.",
      });
      analytics.track("domain_verification_failed", {
        domain,
        error: "exception",
      });
    }
  }, [
    trackedDomainId,
    domain,
    method,
    verifyDomainMutation,
    queryClient,
    domainsQueryKey,
    limitsQueryKey,
  ]);

  const handleReturnLater = useCallback(() => {
    toast.info("Domain saved", {
      description:
        "We'll automatically verify your domain once the changes have propagated. Check back later!",
    });
    handleOpenChange(false);
  }, [handleOpenChange]);

  const handleDone = useCallback(() => {
    onSuccess();
    handleOpenChange(false);
  }, [onSuccess, handleOpenChange]);

  const canProceed = useCallback(() => {
    switch (step) {
      case 1:
        return domain.trim().length > 0 && !addDomainMutation.isPending;
      case 2:
        return verificationState.status !== "verifying";
      case 3:
        return true;
      default:
        return false;
    }
  }, [step, domain, addDomainMutation.isPending, verificationState.status]);

  const handleNext = useCallback(async () => {
    switch (step) {
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
  }, [step, handleAddDomain, handleVerify, handleDone]);

  const goBack = useCallback(() => {
    setVerificationState({ status: "idle" });
    setStep(1);
  }, []);

  // Derived state
  const isResuming = !!resumeDomain;
  const isLoadingInstructions = isResuming && instructionsQuery.isLoading;
  const isInstructionsQueryError = isResuming && instructionsQuery.isError;
  const isMissingInstructions =
    step === 2 && !isLoadingInstructions && !instructions;
  const isVerifying = verificationState.status === "verifying";
  const hasFailed = verificationState.status === "failed";
  const showFooterButtons = step !== 2 || !hasFailed;

  return {
    // State
    step,
    domain,
    setDomain,
    domainError,
    method,
    setMethod,
    instructions,
    verificationState,
    hasAttemptedDomainSubmit,

    // Handlers
    handleOpenChange,
    handleNext,
    handleVerify,
    handleReturnLater,
    goBack,
    canProceed,
    refetchInstructions: instructionsQuery.refetch,

    // Query/mutation state
    isAddingDomain: addDomainMutation.isPending,
    isRefetchingInstructions: instructionsQuery.isFetching,
    instructionsErrorMessage: instructionsQuery.error?.message,

    // Derived state
    isResuming,
    isLoadingInstructions,
    isInstructionsQueryError,
    isMissingInstructions,
    isVerifying,
    hasFailed,
    showFooterButtons,
  };
}
