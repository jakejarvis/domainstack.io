"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { logger } from "@/lib/logger/client";
import type {
  VerificationInstructions,
  VerificationMethod,
} from "@/lib/schemas";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { StepConfirmation } from "./step-confirmation";
import { StepEnterDomain } from "./step-enter-domain";
import { StepInstructionsError } from "./step-instructions-error";
import { StepVerifyOwnership } from "./step-verify-ownership";

export type ResumeDomainData = {
  id: string;
  domainName: string;
  verificationToken: string;
};

export type AddDomainDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** If provided, skips step 1 and goes directly to verification */
  resumeDomain?: ResumeDomainData | null;
};

export type VerificationState =
  | { status: "idle" }
  | { status: "verifying" }
  | { status: "failed"; error?: string };

const STEP_TITLES = ["Enter domain", "Verify ownership", "Complete"];

export function AddDomainDialog({
  open,
  onOpenChange,
  onSuccess,
  resumeDomain,
}: AddDomainDialogProps) {
  const [step, setStep] = useState(1);
  const [domain, setDomain] = useState("");
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

  // Fetch instructions when resuming verification
  const instructionsQuery = useQuery({
    ...trpc.tracking.getVerificationInstructions.queryOptions({
      trackedDomainId: resumeDomain?.id ?? "",
    }),
    enabled: !!resumeDomain && open,
  });

  // When resumeDomain changes and dialog opens, set up resume state
  useEffect(() => {
    if (resumeDomain && open) {
      setDomain(resumeDomain.domainName);
      setTrackedDomainId(resumeDomain.id);
      setStep(2);
    }
  }, [resumeDomain, open]);

  // When instructions are fetched for resume mode, set them
  useEffect(() => {
    if (instructionsQuery.data && resumeDomain) {
      setInstructions(instructionsQuery.data);
    }
  }, [instructionsQuery.data, resumeDomain]);

  const resetDialog = useCallback(() => {
    setStep(1);
    setDomain("");
    setDomainError("");
    setMethod("dns_txt");
    setTrackedDomainId(null);
    setInstructions(null);
    setVerificationState({ status: "idle" });
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        resetDialog();
      }
      onOpenChange(open);
    },
    [onOpenChange, resetDialog],
  );

  const handleAddDomain = async () => {
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
  };

  const handleVerify = async () => {
    if (!trackedDomainId) return;

    setVerificationState({ status: "verifying" });

    try {
      const result = await verifyDomainMutation.mutateAsync({
        trackedDomainId,
        method,
      });

      if (result.verified) {
        setVerificationState({ status: "idle" });
        setStep(3);
        toast.success("Domain verified successfully!");
      } else {
        setVerificationState({
          status: "failed",
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
    }
  };

  const handleReturnLater = () => {
    toast.info("Domain saved", {
      description:
        "We'll automatically verify your domain once the changes have propagated. Check back later!",
    });
    handleOpenChange(false);
  };

  const handleDone = () => {
    onSuccess();
    handleOpenChange(false);
  };

  const canProceed = () => {
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
  };

  const handleNext = async () => {
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
  };

  const isResuming = !!resumeDomain;
  const isLoadingInstructions = isResuming && instructionsQuery.isLoading;
  const instructionsError = isResuming && instructionsQuery.isError;
  const hasInstructionsError =
    step === 2 && !isLoadingInstructions && !instructions;
  const isVerifying = verificationState.status === "verifying";
  const hasFailed = verificationState.status === "failed";

  // Hide the main footer button when showing the failed state (it has its own buttons)
  const showFooterButtons = step !== 2 || !hasFailed;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isResuming ? "Complete Verification" : "Add Domain"}
          </DialogTitle>
          <DialogDescription>
            {isResuming
              ? `Verify ownership of ${domain}`
              : `Step ${step} of 3 — ${STEP_TITLES[step - 1]}`}
          </DialogDescription>
          {/* Step indicator dots - only show for new domain flow */}
          {!isResuming && (
            <div className="flex gap-1.5 pt-2">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    s === step ? "w-6 bg-primary" : "w-1.5 bg-muted",
                  )}
                />
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="min-h-[280px] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${step}-${hasFailed}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 1 && !isResuming && (
                <StepEnterDomain
                  domain={domain}
                  setDomain={setDomain}
                  error={domainError}
                  isLoading={addDomainMutation.isPending}
                  onSubmit={handleNext}
                />
              )}
              {step === 2 && isLoadingInstructions && (
                <div className="flex h-[200px] items-center justify-center">
                  <Spinner className="size-6" />
                </div>
              )}
              {step === 2 && hasInstructionsError && (
                <StepInstructionsError
                  error={
                    instructionsError
                      ? instructionsQuery.error?.message
                      : "Verification instructions could not be loaded."
                  }
                  onRetry={() => instructionsQuery.refetch()}
                  isRetrying={instructionsQuery.isFetching}
                />
              )}
              {step === 2 && instructions && !isLoadingInstructions && (
                <StepVerifyOwnership
                  method={method}
                  setMethod={setMethod}
                  instructions={instructions}
                  verificationState={verificationState}
                  onVerify={handleVerify}
                  onReturnLater={handleReturnLater}
                />
              )}
              {step === 3 && <StepConfirmation domain={domain} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {showFooterButtons && (
          <DialogFooter>
            {step === 2 && !isResuming && !hasFailed && (
              <Button
                variant="outline"
                onClick={() => {
                  setVerificationState({ status: "idle" });
                  setStep(1);
                }}
              >
                Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={
                !canProceed() || isLoadingInstructions || hasInstructionsError
              }
            >
              {(addDomainMutation.isPending || isVerifying) && (
                <Spinner className="size-4" />
              )}
              {step === 2
                ? isVerifying
                  ? "Verifying..."
                  : "Verify & Continue"
                : step === 3
                  ? "Done"
                  : "Continue"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
