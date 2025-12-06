"use client";

import { AnimatePresence, motion } from "motion/react";
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
import {
  type ResumeDomainData,
  useDomainVerification,
} from "@/hooks/use-domain-verification";
import { cn } from "@/lib/utils";
import { StepConfirmation } from "./step-confirmation";
import { StepEnterDomain } from "./step-enter-domain";
import { StepInstructionsError } from "./step-instructions-error";
import { StepVerifyOwnership } from "./step-verify-ownership";

export type { ResumeDomainData };

export type AddDomainDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** If provided, skips step 1 and goes directly to verification */
  resumeDomain?: ResumeDomainData | null;
};

const STEP_TITLES = ["Enter domain", "Verify ownership", "Complete"];

export function AddDomainDialog({
  open,
  onOpenChange,
  onSuccess,
  resumeDomain,
}: AddDomainDialogProps) {
  const {
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
    refetchInstructions,

    // Query/mutation state
    isAddingDomain,
    isRefetchingInstructions,
    instructionsErrorMessage,

    // Derived state
    isResuming,
    isLoadingInstructions,
    instructionsError,
    hasInstructionsError,
    isVerifying,
    hasFailed,
    showFooterButtons,
  } = useDomainVerification({
    open,
    onOpenChange,
    onSuccess,
    resumeDomain,
  });

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
          {/* Step info is already in DialogDescription, dots are decorative */}
          {!isResuming && (
            <div
              className="flex gap-1.5 pt-2"
              role="group"
              aria-label={`Step ${step} of 3: ${STEP_TITLES[step - 1]}`}
            >
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  aria-hidden="true"
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
                  isLoading={isAddingDomain}
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
                      ? instructionsErrorMessage
                      : "Verification instructions could not be loaded."
                  }
                  onRetry={() => refetchInstructions()}
                  isRetrying={isRefetchingInstructions}
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
              <Button variant="outline" onClick={goBack}>
                Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={
                !canProceed() || isLoadingInstructions || hasInstructionsError
              }
            >
              {(isAddingDomain || isVerifying) && (
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
