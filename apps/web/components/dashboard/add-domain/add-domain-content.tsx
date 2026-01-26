import {
  IconAlertCircle,
  IconCheck,
  IconGauge,
  IconMeteor,
  IconRocket,
} from "@tabler/icons-react";
import { ShareInstructionsDialog } from "@/components/dashboard/add-domain/share-instructions-dialog";
import { StepConfirmation } from "@/components/dashboard/add-domain/step-confirmation";
import { StepEnterDomain } from "@/components/dashboard/add-domain/step-enter-domain";
import { StepInstructionsError } from "@/components/dashboard/add-domain/step-instructions-error";
import { StepVerifyOwnership } from "@/components/dashboard/add-domain/step-verify-ownership";
import { QuotaBar } from "@/components/dashboard/quota-bar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTrigger,
} from "@/components/ui/stepper";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UpgradeButton } from "@/components/upgrade-button";
import { useDomainVerification } from "@/hooks/use-domain-verification";
import { useSubscription } from "@/hooks/use-subscription";
import { PLAN_QUOTAS } from "@/lib/constants/plan-quotas";
import { PRO_TIER_INFO } from "@/lib/polar/products";
import type { ResumeDomainData } from "@/lib/types/verification";

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

export function AddDomainContent({
  className,
  onClose,
  onSuccess,
  resumeDomain,
  prefillDomain,
}: AddDomainContentProps) {
  // Check user subscription
  const {
    subscription,
    isPro,
    isSubscriptionLoading,
    isSubscriptionError,
    refetchSubscription,
  } = useSubscription();

  const {
    // State
    step,
    domain,
    setDomain,
    domainError,
    method,
    setMethod,
    verificationToken,
    verificationState,
    hasAttemptedDomainSubmit,
    trackedDomainId,

    // Handlers
    handleNext,
    handleVerify,
    handleReturnLater,
    canProceed,
    refetchVerificationData,

    // Query/mutation state
    isAddingDomain,
    isRefetchingVerificationData,
    verificationDataErrorMessage,

    // Derived state
    isResuming,
    isPrefilled,
    isLoadingVerificationData,
    isVerificationDataQueryError,
    isMissingVerificationData,
    isVerifying,
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

  // Show loading spinner while checking subscription
  if (isSubscriptionLoading) {
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
          <Icon size="lg" variant="destructive" className="mb-2">
            <IconAlertCircle />
          </Icon>
          <h2 className="font-semibold text-lg leading-none tracking-tight">
            Unable to Load Subscription
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            We couldn&apos;t load your subscription details. Please try again.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            onClick={() => void refetchSubscription()}
            disabled={isSubscriptionLoading}
            className="w-full"
          >
            Retry
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose} className="w-full">
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
  if (!subscription?.canAddMore && !resumeDomain && step !== 3) {
    const quotaContent = (
      <>
        <div className="mb-4 flex flex-col items-center text-center">
          <Icon size="lg" variant="warning" className="mb-3">
            <IconGauge />
          </Icon>
          <h2 className="font-semibold text-lg tracking-tight">
            Domain Limit Reached
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            You&apos;ve reached your limit of {subscription?.planQuota} tracked
            domain
            {subscription?.planQuota !== 1 && "s"}.
          </p>
        </div>

        <div className="space-y-4">
          {/* Usage indicator */}
          <div className="flex items-center justify-between rounded-xl border border-black/10 bg-muted/30 p-4 dark:border-white/10">
            <div>
              <div className="font-medium">{isPro ? "Pro" : "Free"} Plan</div>
              <p className="text-muted-foreground text-sm">
                {subscription?.activeCount} of {subscription?.planQuota} domains
                used
              </p>
            </div>
            {subscription && (
              <QuotaBar
                used={subscription.activeCount}
                planQuota={subscription.planQuota}
                className="w-24"
              />
            )}
          </div>

          {isPro ? (
            <>
              {/* Pro user at limit */}
              <p className="text-center text-muted-foreground text-sm">
                You can archive unused domains to make room for new ones, or
                remove domains you no longer need to track.
              </p>
              {onClose && (
                <Button variant="outline" onClick={onClose} className="w-full">
                  Close
                </Button>
              )}
            </>
          ) : (
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

                <div className="mb-2 flex items-center gap-2 font-medium">
                  <IconMeteor className="size-4" />
                  {PRO_TIER_INFO.name} Plan
                </div>
                <ul className="relative mb-3 space-y-1 text-muted-foreground text-sm">
                  <li>Track up to {PLAN_QUOTAS.pro} domains</li>
                  <li>Priority email notifications</li>
                  <li>Support development</li>
                </ul>
                <div className="relative flex items-baseline gap-2 text-sm">
                  <span className="font-semibold text-accent-gold">
                    {PRO_TIER_INFO.monthly.label}
                  </span>
                  <span className="text-muted-foreground">or</span>
                  <span className="font-semibold text-accent-gold">
                    {PRO_TIER_INFO.yearly.label}
                  </span>
                  <span className="text-muted-foreground/70 text-xs">
                    ({PRO_TIER_INFO.yearly.savings})
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <UpgradeButton className="w-full" icon={IconRocket}>
                  Upgrade to Pro
                </UpgradeButton>
                {onClose && (
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="w-full"
                  >
                    Close
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </>
    );

    return <div className={className}>{quotaContent}</div>;
  }

  return (
    <div className={className}>
      <div className="space-y-1">
        <h2 className="font-semibold text-base">
          {isResuming ? "Complete Verification" : "Add Domain"}
        </h2>
        <p className="text-muted-foreground text-sm">
          {isResuming
            ? domain
              ? `Verify ownership of ${domain}`
              : "Verify ownership"
            : "Track and monitor your domain"}
        </p>
      </div>

      <Stepper
        value={step}
        indicators={{
          completed: <IconCheck className="size-4" />,
          loading: <Spinner className="size-4" />,
        }}
      >
        <StepperNav className="mb-1 py-5">
          <StepperItem step={1} loading={isAddingDomain}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <StepperTrigger>
                    <StepperIndicator>1</StepperIndicator>
                  </StepperTrigger>
                }
              />
              <TooltipContent sideOffset={6}>Enter domain</TooltipContent>
            </Tooltip>
            <StepperSeparator />
          </StepperItem>
          <StepperItem
            step={2}
            loading={isLoadingVerificationData || isVerifying}
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <StepperTrigger>
                    <StepperIndicator>2</StepperIndicator>
                  </StepperTrigger>
                }
              />
              <TooltipContent sideOffset={6}>Verify ownership</TooltipContent>
            </Tooltip>
            <StepperSeparator />
          </StepperItem>
          <StepperItem step={3}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <StepperTrigger>
                    <StepperIndicator>3</StepperIndicator>
                  </StepperTrigger>
                }
              />
              <TooltipContent sideOffset={6}>Done!</TooltipContent>
            </Tooltip>
          </StepperItem>
        </StepperNav>

        <StepperPanel>
          <StepperContent
            value={1}
            className="flex min-h-[200px] flex-col justify-between"
          >
            <StepEnterDomain
              domain={domain}
              setDomain={setDomain}
              error={hasAttemptedDomainSubmit ? domainError : ""}
              isLoading={isAddingDomain}
              onSubmit={handleNext}
              hasAttemptedSubmit={hasAttemptedDomainSubmit}
              readOnly={isPrefilled}
            />
            <div className="mt-6 flex w-full items-center justify-end">
              <Button onClick={handleNext} disabled={!canProceed}>
                {isAddingDomain && <Spinner />}
                Continue
              </Button>
            </div>
          </StepperContent>

          <StepperContent value={2}>
            {isLoadingVerificationData && (
              <div className="flex h-[200px] items-center justify-center">
                <Spinner className="size-6" />
              </div>
            )}
            {isMissingVerificationData && (
              <StepInstructionsError
                error={
                  isVerificationDataQueryError
                    ? verificationDataErrorMessage
                    : "Verification details could not be loaded."
                }
                onRetry={() => refetchVerificationData()}
                isRetrying={isRefetchingVerificationData}
              />
            )}
            {verificationToken &&
              !isLoadingVerificationData &&
              (trackedDomainId ? (
                <>
                  <StepVerifyOwnership
                    method={method}
                    setMethod={setMethod}
                    domain={domain}
                    verificationToken={verificationToken}
                    verificationState={verificationState}
                    onVerify={handleVerify}
                    onReturnLater={handleReturnLater}
                  />

                  <div className="mt-6 flex w-full items-center justify-between gap-2">
                    <div className="flex-1">
                      <ShareInstructionsDialog
                        domain={domain}
                        verificationToken={verificationToken}
                        trackedDomainId={trackedDomainId}
                      />
                    </div>
                    <Button
                      onClick={handleNext}
                      disabled={
                        !canProceed ||
                        isLoadingVerificationData ||
                        isMissingVerificationData
                      }
                    >
                      {isVerifying ? <Spinner /> : <IconCheck />}
                      {isVerifying ? "Checking…" : "Check Now"}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex h-[200px] flex-col items-center justify-center space-y-4">
                  <Icon size="lg" variant="destructive" className="mx-auto">
                    <IconAlertCircle />
                  </Icon>
                  <div className="text-center" aria-live="polite">
                    <h3 className="font-semibold">Something went wrong</h3>
                    <p className="text-muted-foreground text-sm">
                      Domain tracking ID is missing. Please try adding the
                      domain again.
                    </p>
                  </div>
                  {onClose && (
                    <Button variant="outline" onClick={onClose}>
                      Close
                    </Button>
                  )}
                </div>
              ))}
          </StepperContent>

          <StepperContent value={3}>
            <StepConfirmation domain={domain} />
            <div className="mt-6 flex w-full items-center justify-end">
              <Button onClick={handleNext}>Done</Button>
            </div>
          </StepperContent>
        </StepperPanel>
      </Stepper>
    </div>
  );
}
