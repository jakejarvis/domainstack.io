"use client";

import { AlertCircle, Check, Gauge, ShoppingCart } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { ShareInstructionsDialog } from "@/components/dashboard/add-domain/share-instructions-dialog";
import { StepConfirmation } from "@/components/dashboard/add-domain/step-confirmation";
import { StepEnterDomain } from "@/components/dashboard/add-domain/step-enter-domain";
import { StepInstructionsError } from "@/components/dashboard/add-domain/step-instructions-error";
import { StepVerifyOwnership } from "@/components/dashboard/add-domain/step-verify-ownership";
import { UsageMeter } from "@/components/dashboard/usage-meter";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { type Step, Stepper } from "@/components/ui/stepper";
import {
  type ResumeDomainData,
  useDomainVerification,
} from "@/hooks/use-domain-verification";
import { useSubscription } from "@/hooks/use-subscription";
import { useUpgradeCheckout } from "@/hooks/use-upgrade-checkout";
import { DEFAULT_TIER_LIMITS } from "@/lib/constants";
import { getProTierInfo } from "@/lib/polar/products";

export type { ResumeDomainData };

export type AddDomainContentProps = {
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
  className,
  onClose,
  onSuccess,
  resumeDomain,
  prefillDomain,
}: AddDomainContentProps) {
  const { handleUpgrade, isLoading: isCheckoutLoading } = useUpgradeCheckout();

  // Check user subscription
  const {
    subscription,
    isLoading: isLoadingSubscription,
    isError: isSubscriptionError,
    refetch: refetchSubscription,
  } = useSubscription();

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

  // Extract subscription data
  const activeCount = subscription?.activeCount ?? 0;
  const maxDomains = subscription?.maxDomains ?? DEFAULT_TIER_LIMITS.free;
  const proMaxDomains = subscription?.proMaxDomains ?? DEFAULT_TIER_LIMITS.pro;
  const tier = subscription?.tier ?? "free";
  const canAddMore = subscription?.canAddMore ?? true;

  // Show loading spinner while checking subscription
  if (isLoadingSubscription) {
    const loadingContent = (
      <div className="flex min-h-[200px] items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );

    return <div className={className}>{loadingContent}</div>;
  }

  // Show error state if subscription check failed
  if (isSubscriptionError) {
    const errorContent = (
      <>
        <div className="mb-4 flex flex-col items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="size-6 text-destructive" />
          </div>
          <h2 className="font-semibold text-lg leading-none tracking-tight">
            Unable to Load Subscription
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            We couldn&apos;t load your subscription details. Please try again.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            onClick={() => refetchSubscription()}
            className="w-full cursor-pointer"
          >
            Retry
          </Button>
          {onClose && (
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full cursor-pointer"
            >
              Close
            </Button>
          )}
        </div>
      </>
    );

    return <div className={className}>{errorContent}</div>;
  }

  // If at quota (and not resuming verification for an existing domain), show quota message
  // Exception: If we just finished adding a domain (step 3), don't show the limit message yet
  if (!canAddMore && !resumeDomain && step !== 3) {
    const proTierInfo = getProTierInfo(proMaxDomains);

    const quotaContent = (
      <>
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

        <div className="space-y-6">
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
            <UsageMeter
              activeCount={activeCount}
              maxDomains={maxDomains}
              className="w-24"
              aria-label="Domain usage"
            />
          </div>

          {tier === "free" ? (
            <>
              {/* Pro upgrade option */}
              <div className="relative overflow-hidden rounded-xl border border-black/10 bg-gradient-to-br from-black/[0.02] to-black/[0.04] p-4 dark:border-white/10 dark:from-white/[0.02] dark:to-white/[0.04]">
                {/* Decorative elements - subtle warm glows */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-8 -right-8 size-32 rounded-full bg-accent-gold/15 blur-3xl"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute -bottom-8 -left-8 size-24 rounded-full bg-accent-gold-muted/20 blur-3xl"
                />

                <div className="relative mb-2 font-medium">
                  {proTierInfo.name}
                </div>
                <ul className="relative mb-3 space-y-1 text-muted-foreground text-sm">
                  {proTierInfo.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
                <div className="relative flex items-baseline gap-2 text-sm">
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
                  className="w-full cursor-pointer leading-none"
                >
                  {isCheckoutLoading ? (
                    <>
                      <Spinner />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ShoppingCart />
                      Upgrade to Pro
                    </>
                  )}
                </Button>
                {onClose && (
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="w-full cursor-pointer leading-none"
                  >
                    Close
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
              {onClose && (
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="w-full cursor-pointer leading-none"
                >
                  Close
                </Button>
              )}
            </>
          )}
        </div>
      </>
    );

    return <div className={className}>{quotaContent}</div>;
  }

  // Normal add domain flow
  const title = isResuming ? "Complete Verification" : "Add Domain";
  const description = isResuming
    ? domain
      ? `Verify ownership of ${domain}`
      : "Verify ownership"
    : "Track and monitor your domain";

  const headerContent = (
    <>
      <h2 className="font-semibold text-lg leading-none tracking-tight">
        {title}
      </h2>
      <p className="text-muted-foreground text-sm">{description}</p>
      <Stepper steps={STEPS} currentStep={step} className="mb-6 pt-4" />
    </>
  );

  const mainContent = (
    <div className="min-h-[200px]">
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
            !trackedDomainId && (
              <div className="flex h-[200px] flex-col items-center justify-center space-y-4">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="size-6 text-destructive" />
                </div>
                <div className="text-center" aria-live="polite">
                  <h3 className="font-semibold">Something went wrong</h3>
                  <p className="text-muted-foreground text-sm">
                    Domain tracking ID is missing. Please try adding the domain
                    again.
                  </p>
                </div>
                {onClose && (
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="cursor-pointer leading-none"
                  >
                    Close
                  </Button>
                )}
              </div>
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
                domain={domain}
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
    <div className="mt-6 flex w-full items-center justify-between gap-2">
      {/* Left side: Share instructions button (only on step 2) */}
      <div className="flex-1">
        {step === 2 && instructions && trackedDomainId && (
          <ShareInstructionsDialog
            domain={domain}
            instructions={instructions}
            trackedDomainId={trackedDomainId}
          />
        )}
      </div>

      {/* Right side: Confirmation/Next button */}
      <Button
        onClick={handleNext}
        disabled={
          !canProceed() || isLoadingInstructions || isMissingInstructions
        }
        className="cursor-pointer leading-none"
      >
        {isAddingDomain || isVerifying ? (
          <Spinner />
        ) : step === 2 ? (
          <Check />
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

  return (
    <div className={className}>
      <div className="space-y-1.5">{headerContent}</div>
      {mainContent}
      {footerContent}
    </div>
  );
}
