"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { analytics } from "@/lib/analytics/client";
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  resumeDomain?: ResumeDomainData | null;
  /** Pre-fill the domain input (e.g., from domain report "Track" button) */
  prefillDomain?: string;
};

export function useDomainVerification({
  open,
  onOpenChange,
  onSuccess,
  resumeDomain,
  prefillDomain,
}: UseDomainVerificationOptions) {
  const [step, setStep] = useState(1);
  const [domain, setDomain] = useState(prefillDomain ?? "");
  const [domainError, setDomainError] = useState("");
  const [method, setMethod] = useState<VerificationMethod>("dns_txt");
  const [trackedDomainId, setTrackedDomainId] = useState<string | null>(null);
  const [instructions, setInstructions] =
    useState<VerificationInstructions | null>(null);
  const [verificationState, setVerificationState] = useState<VerificationState>(
    { status: "idle" },
  );

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Query keys for invalidation
  const domainsQueryKey = trpc.tracking.listDomains.queryKey();
  const limitsQueryKey = trpc.tracking.getLimits.queryKey();

  const addDomainMutation = useMutation({
    ...trpc.tracking.addDomain.mutationOptions(),
    onSuccess: () => {
      // Invalidate queries immediately so the domain appears in the list
      // (even if user closes dialog before completing verification)
      void queryClient.invalidateQueries({ queryKey: domainsQueryKey });
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

  // When resumeDomain changes and dialog opens, set up resume state
  // Reset all state to avoid showing stale data from a previous domain
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

  // Sync domain state when prefillDomain changes (only when dialog is closed)
  useEffect(() => {
    if (!open && prefillDomain !== undefined) {
      setDomain(prefillDomain);
    }
  }, [prefillDomain, open]);

  // Clear domain error when user edits the domain input
  useEffect(() => {
    if (domainError) {
      setDomainError("");
    }
  }, [domainError]); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally omit domainError to avoid infinite loop

  const resetDialog = useCallback(() => {
    setStep(1);
    setDomain(prefillDomain ?? "");
    setDomainError("");
    setMethod("dns_txt");
    setTrackedDomainId(null);
    setInstructions(null);
    setVerificationState({ status: "idle" });
  }, [prefillDomain]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        resetDialog();
      }
      onOpenChange(open);
    },
    [onOpenChange, resetDialog],
  );

  const handleAddDomain = useCallback(async () => {
    setDomainError("");

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
  }, [trackedDomainId, domain, method, verifyDomainMutation]);

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
