import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";
import { createInitialState, toStep1, toStep2, toStep3 } from "@/lib/verification-state";
import type { VerificationMethod } from "@domainstack/constants";
import type { ResumeDomainData, VerificationState } from "@domainstack/types";
import { isValidDomain, normalizeDomainInput } from "@domainstack/utils/domain/client";

interface UseDomainVerificationOptions {
  onSuccess: () => void;
  onClose?: () => void;
  resumeDomain?: ResumeDomainData | null;
  /** Pre-fill the domain input (e.g., from domain report "Track" button) */
  prefillDomain?: string;
}

export const DOMAIN_VALIDATION_ERROR = "Enter a valid domain, like example.com (no https://).";

export function useDomainVerification({
  onSuccess,
  onClose,
  resumeDomain,
  prefillDomain,
}: UseDomainVerificationOptions) {
  const [state, setState] = useState(() => createInitialState(resumeDomain, prefillDomain));
  const [methodOverride, setMethodOverride] = useState<VerificationMethod | null>(
    resumeDomain?.verificationMethod ?? null,
  );

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  const invalidateQueries = useCallback(() => {
    void queryClient.invalidateQueries(trpc.tracking.listDomains.queryFilter());
    void queryClient.invalidateQueries(trpc.user.getSubscription.queryFilter());
  }, [queryClient, trpc]);

  const addDomainMutation = useMutation({
    ...trpc.tracking.addDomain.mutationOptions(),
    onSettled: invalidateQueries,
  });

  const verifyDomainMutation = useMutation({
    ...trpc.tracking.verifyDomain.mutationOptions(),
    onSettled: invalidateQueries,
  });

  const isResuming = !!resumeDomain;
  const trackedDomainId = state.step === 1 ? null : state.trackedDomainId;
  const localToken = state.step === 2 ? state.verificationToken : "";
  const shouldFetchVerificationData = isResuming && !!trackedDomainId && !localToken;

  const verificationDataQuery = useQuery(
    trpc.tracking.getVerificationData.queryOptions(
      shouldFetchVerificationData && trackedDomainId ? { trackedDomainId } : skipToken,
    ),
  );

  const queryToken = verificationDataQuery.data?.verificationToken ?? "";
  const queryDomain = verificationDataQuery.data?.domain ?? "";
  const verificationToken = state.step === 2 ? localToken || queryToken : "";
  const domain = state.step === 2 ? state.domain || queryDomain : state.domain;
  const method = methodOverride ?? verificationDataQuery.data?.verificationMethod ?? "dns_txt";

  const isVerifying = verifyDomainMutation.isPending;
  const verificationState: VerificationState = isVerifying
    ? { status: "verifying" }
    : verifyDomainMutation.isError ||
        (verifyDomainMutation.isSuccess && !verifyDomainMutation.data.verified)
      ? { status: "failed" }
      : { status: "idle" };

  const isLoadingVerificationData = isResuming && verificationDataQuery.isLoading;
  const isVerificationDataQueryError = isResuming && verificationDataQuery.isError;
  const isMissingVerificationData =
    state.step === 2 && !isLoadingVerificationData && !verificationToken;

  const setDomain = useCallback((value: string) => {
    setState((current) =>
      current.step === 1 ? { ...current, domain: value, domainError: "" } : current,
    );
  }, []);

  const setMethod = useCallback((nextMethod: VerificationMethod) => {
    setMethodOverride(nextMethod);
  }, []);

  const resetFlow = useCallback(() => {
    setState(toStep1(prefillDomain));
    addDomainMutation.reset();
    verifyDomainMutation.reset();
    setMethodOverride(null);
  }, [prefillDomain, addDomainMutation, verifyDomainMutation]);

  const closeFlow = useCallback(() => {
    resetFlow();
    onClose?.();
  }, [resetFlow, onClose]);

  const handleAddDomain = useCallback(async () => {
    if (state.step !== 1) return;

    const normalized = normalizeDomainInput(state.domain);
    if (!isValidDomain(normalized)) {
      setState((current) =>
        current.step === 1 ? { ...current, domainError: DOMAIN_VALIDATION_ERROR } : current,
      );
      return;
    }

    setState((current) => (current.step === 1 ? { ...current, domainError: "" } : current));

    try {
      const result = await addDomainMutation.mutateAsync({
        domain: normalized,
      });

      setState(toStep2(normalized, result.id, result.verificationToken));

      if (result.resumed) {
        toast.info("Resuming verification", {
          description:
            "You previously started tracking this domain. Your verification token is unchanged.",
        });
      }
    } catch (err) {
      setState((current) =>
        current.step === 1
          ? {
              ...current,
              domainError: err instanceof Error ? err.message : "Failed to add domain",
            }
          : current,
      );
    }
  }, [state, addDomainMutation]);

  const handleVerify = useCallback(async () => {
    if (state.step !== 2) return;

    try {
      const result = await verifyDomainMutation.mutateAsync({
        trackedDomainId: state.trackedDomainId,
      });

      if (result.verified) {
        setState(toStep3(state));
        toast.success("Domain verified successfully!");
        onSuccessRef.current();
      }
    } catch {
      // Failed status is derived from the mutation
    }
  }, [state, verifyDomainMutation]);

  const handleReturnLater = useCallback(() => {
    toast.info("Domain saved", {
      description:
        "We'll automatically verify your domain once the changes have propagated. Check back later!",
    });
    closeFlow();
  }, [closeFlow]);

  return {
    step: state.step,
    domain,
    setDomain,
    domainError: state.step === 1 ? state.domainError : "",
    method,
    setMethod,
    verificationToken,
    verificationState,
    trackedDomainId,

    handleAddDomain,
    handleVerify,
    handleReturnLater,
    handleDone: closeFlow,
    refetchVerificationData: verificationDataQuery.refetch,

    isAddingDomain: addDomainMutation.isPending,
    isRefetchingVerificationData: verificationDataQuery.isFetching,
    verificationDataErrorMessage: verificationDataQuery.error?.message,

    isResuming,
    isPrefilled: !!prefillDomain && !isResuming,
    isLoadingVerificationData,
    isVerificationDataQueryError,
    isMissingVerificationData,
    isVerifying,
  };
}
