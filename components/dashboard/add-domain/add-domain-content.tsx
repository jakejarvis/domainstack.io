"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Gauge, Gem } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { StepConfirmation } from "@/components/dashboard/add-domain/step-confirmation";
import { StepEnterDomain } from "@/components/dashboard/add-domain/step-enter-domain";
import { StepInstructionsError } from "@/components/dashboard/add-domain/step-instructions-error";
import { StepVerifyOwnership } from "@/components/dashboard/add-domain/step-verify-ownership";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { type Step, Stepper } from "@/components/ui/stepper";
import {
  type ResumeDomainData,
  useDomainVerification,
} from "@/hooks/use-domain-verification";
import { useUpgradeCheckout } from "@/hooks/use-upgrade-checkout";
import { DEFAULT_TIER_LIMITS } from "@/lib/constants";
import { getProTierInfo } from "@/lib/polar/products";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

export type { ResumeDomainData };

export type AddDomainContentProps = {
  /** Whether to show the card wrapper (false for modal usage) */
  showCard?: boolean;
  /** Additional classes for the wrapper */
  className?: string;
  /** Handler when the flow should close (cancel, done, etc.) - optional for page usage */
  onClose?: () => void;
  /** Handler when domain is successfully added and verified */
  onSuccess: () => void;
  /** If provided, skips step 1 and goes directly to verification */
  resumeDomain?: ResumeDomainData | null;
  /** Pre-fill the domain input (e.g., from domain report "Track" button) */
  prefillDomain?: string;
};

const STEPS: Step[] = [
  { title: "Enter domain" },
  { title: "Verify ownership" },
  { title: "Complete" },
];

export function AddDomainContent({
  showCard = true,
  className,
  onClose,
  onSuccess,
  resumeDomain,
  prefillDomain,
}: AddDomainContentProps) {
  const trpc = useTRPC();
  const { handleUpgrade, isLoading: isCheckoutLoading } = useUpgradeCheckout();

  // Check user limits
  const limitsQuery = useQuery(trpc.tracking.getLimits.queryOptions());

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
    hasAttemptedDomainSubmit,
    trackedDomainId,

    // Handlers
    handleNext,
    handleVerify,
    handleReturnLater,
    canProceed,
    refetchInstructions,

    // Query/mutation state
    isAddingDomain,
    isRefetchingInstructions,
    instructionsErrorMessage,

    // Derived state
    isResuming,
    isPrefilled,
    isLoadingInstructions,
    isInstructionsQueryError,
    isMissingInstructions,
    isVerifying,
    hasFailed,
    showFooterButtons,
  } = useDomainVerification({
    open: true,
    onOpenChange: (open) => {
      if (!open) {
        onClose?.();
      }
    },
    onSuccess,
    resumeDomain,
    prefillDomain,
  });

  // Extract limits data
  const limits = limitsQuery.data;
  const activeCount = limits?.activeCount ?? 0;
  const maxDomains = limits?.maxDomains ?? DEFAULT_TIER_LIMITS.free;
  const proMaxDomains = limits?.proMaxDomains ?? DEFAULT_TIER_LIMITS.pro;
  const tier = limits?.tier ?? "free";
  const canAddMore = limits?.canAddMore ?? true;

  // Show loading spinner while checking limits
  if (limitsQuery.isLoading) {
    const loadingContent = (
      <div className="flex min-h-[200px] items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );

    if (!showCard) {
      return <div className={className}>{loadingContent}</div>;
    }

    return (
      <Card className={cn("w-full max-w-lg", className)}>{loadingContent}</Card>
    );
  }

  // If at quota (and not resuming verification for an existing domain), show quota message
  if (!canAddMore && !resumeDomain) {
    const percentage =
      maxDomains > 0 ? Math.min((activeCount / maxDomains) * 100, 100) : 0;
    const proTierInfo = getProTierInfo(proMaxDomains);

    const quotaContent = (
      <>
        {showCard ? (
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-amber-500/10">
              <Gauge className="size-6 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle>Domain Limit Reached</CardTitle>
            <CardDescription>
              You&apos;ve reached your limit of {maxDomains} tracked domain
              {maxDomains !== 1 && "s"}.
            </CardDescription>
          </CardHeader>
        ) : (
          <div className="mb-4 flex flex-col items-center text-center">
            <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-amber-500/10">
              <Gauge className="size-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="font-semibold text-lg leading-none tracking-tight">
              Domain Limit Reached
            </h2>
            <p className="mt-1 text-muted-foreground text-sm">
              You&apos;ve reached your limit of {maxDomains} tracked domain
              {maxDomains !== 1 && "s"}.
            </p>
          </div>
        )}

        <div className={cn("space-y-6", showCard ? "" : "")}>
          {/* Usage indicator */}
          <div className="flex items-center justify-between rounded-xl border border-black/10 bg-muted/30 p-4 dark:border-white/10">
            <div>
              <div className="font-medium">
                {tier === "pro" ? "Pro" : "Free"} Plan
              </div>
              <p className="text-muted-foreground text-sm">
                {activeCount} of {maxDomains} domains used
              </p>
            </div>
            <Progress
              value={percentage}
              className="w-24"
              aria-label="Domain usage"
            />
          </div>

          {tier === "free" ? (
            <>
              {/* Pro upgrade option */}
              <div className="rounded-xl border border-black/10 bg-gradient-to-br from-black/[0.02] to-black/[0.04] p-4 dark:border-white/10 dark:from-white/[0.02] dark:to-white/[0.04]">
                <div className="mb-2 font-medium">{proTierInfo.name}</div>
                <ul className="mb-3 space-y-1 text-muted-foreground text-sm">
                  {proTierInfo.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="font-semibold text-accent-gold">
                    {proTierInfo.monthly.label}
                  </span>
                  <span className="text-muted-foreground">or</span>
                  <span className="font-semibold text-accent-gold">
                    {proTierInfo.yearly.label}
                  </span>
                  <span className="text-muted-foreground/70 text-xs">
                    ({proTierInfo.yearly.savings})
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleUpgrade}
                  disabled={isCheckoutLoading}
                  className="w-full cursor-pointer bg-foreground text-background hover:bg-foreground/90"
                >
                  {isCheckoutLoading ? <Spinner /> : <Gem className="size-4" />}
                  {isCheckoutLoading ? "Opening..." : "Upgrade to Pro"}
                </Button>
                {onClose ? (
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="w-full"
                  >
                    Close
                  </Button>
                ) : (
                  <Button variant="outline" asChild className="w-full">
                    <Link href="/dashboard">Back to Dashboard</Link>
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Pro user at limit */}
              <p className="text-center text-muted-foreground text-sm">
                You can archive unused domains to make room for new ones, or
                remove domains you no longer need to track.
              </p>
              {onClose ? (
                <Button variant="outline" onClick={onClose} className="w-full">
                  Close
                </Button>
              ) : (
                <Button variant="outline" asChild className="w-full">
                  <Link href="/dashboard">Back to Dashboard</Link>
                </Button>
              )}
            </>
          )}
        </div>
      </>
    );

    if (!showCard) {
      return <div className={className}>{quotaContent}</div>;
    }

    return (
      <Card className={cn("w-full max-w-lg", className)}>
        {quotaContent}
        <CardContent />
      </Card>
    );
  }

  // Normal add domain flow
  const title = isResuming ? "Complete Verification" : "Add Domain";
  const description = isResuming
    ? `Verify ownership of ${domain}`
    : "Track and monitor your domain";

  const headerContent = (
    <>
      {showCard ? (
        <>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </>
      ) : (
        <>
          <h2 className="font-semibold text-lg leading-none tracking-tight">
            {title}
          </h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </>
      )}
      <Stepper steps={STEPS} currentStep={step} className="mb-6 pt-4" />
    </>
  );

  const mainContent = (
    <div className="min-h-[280px]">
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
              hasAttemptedSubmit={hasAttemptedDomainSubmit}
              readOnly={isPrefilled}
            />
          )}
          {step === 2 && isLoadingInstructions && (
            <div className="flex h-[200px] items-center justify-center">
              <Spinner className="size-6" />
            </div>
          )}
          {step === 2 && isMissingInstructions && (
            <StepInstructionsError
              error={
                isInstructionsQueryError
                  ? instructionsErrorMessage
                  : "Verification instructions could not be loaded."
              }
              onRetry={() => refetchInstructions()}
              isRetrying={isRefetchingInstructions}
            />
          )}
          {step === 2 &&
            instructions &&
            !isLoadingInstructions &&
            trackedDomainId && (
              <StepVerifyOwnership
                method={method}
                setMethod={setMethod}
                instructions={instructions}
                verificationState={verificationState}
                trackedDomainId={trackedDomainId}
                onVerify={handleVerify}
                onReturnLater={handleReturnLater}
              />
            )}
          {step === 3 && <StepConfirmation domain={domain} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );

  const footerContent = showFooterButtons && (
    <div className="mt-6 flex items-center justify-end gap-2">
      <Button
        onClick={handleNext}
        disabled={
          !canProceed() || isLoadingInstructions || isMissingInstructions
        }
        className="cursor-pointer"
      >
        {isAddingDomain || isVerifying ? (
          <Spinner className="size-4" />
        ) : step === 2 ? (
          <Check className="size-4" />
        ) : null}
        {step === 2
          ? isVerifying
            ? "Checking..."
            : "Check Now"
          : step === 3
            ? "Done"
            : "Continue"}
      </Button>
    </div>
  );

  if (!showCard) {
    return (
      <div className={className}>
        <div className="space-y-1.5">{headerContent}</div>
        {mainContent}
        {footerContent}
      </div>
    );
  }

  return (
    <Card className={cn("w-full max-w-lg", className)}>
      <CardHeader>{headerContent}</CardHeader>
      <CardContent>{mainContent}</CardContent>
      {footerContent && (
        <CardFooter className="justify-end border-t">
          {footerContent}
        </CardFooter>
      )}
    </Card>
  );
}
