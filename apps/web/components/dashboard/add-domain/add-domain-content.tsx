import { IconAlertCircle, IconCheck, IconGauge } from "@tabler/icons-react";

import { ShareInstructionsDialog } from "@/components/dashboard/add-domain/share-instructions-dialog";
import { StepConfirmation } from "@/components/dashboard/add-domain/step-confirmation";
import { StepEnterDomain } from "@/components/dashboard/add-domain/step-enter-domain";
import { StepInstructionsError } from "@/components/dashboard/add-domain/step-instructions-error";
import { StepVerifyOwnership } from "@/components/dashboard/add-domain/step-verify-ownership";
import { PlanStatusCard } from "@/components/plan-status-card";
import { UpgradeCard } from "@/components/upgrade-card";
import { useDomainVerification } from "@/hooks/use-domain-verification";
import { useSubscription } from "@/hooks/use-subscription";
import type {
  ResumeDomainData,
  SubscriptionQuota,
  VerificationMethod,
  VerificationState,
} from "@domainstack/types";
import { Button } from "@domainstack/ui/button";
import { Icon } from "@domainstack/ui/icon";
import { Spinner } from "@domainstack/ui/spinner";
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTrigger,
} from "@domainstack/ui/stepper";
import { Tooltip, TooltipContent, TooltipTrigger } from "@domainstack/ui/tooltip";

export type AddDomainContentProps = {
  /** Additional classes for the wrapper */
  className?: string;
  /** Handler when the flow should close (cancel, done, etc.) - optional for page usage */
  onClose?: () => void;
  /** Handler when domain is successfully added and verified */
  onSuccess: () => void;
  /** True while navigating away after success (page variant). */
  isNavigating?: boolean;
  /** If provided, skips step 1 and goes directly to verification */
  resumeDomain?: ResumeDomainData | null;
  /** Pre-fill the domain input (e.g., from domain report "Track" button) */
  prefillDomain?: string;
};

function AddDomainLoading({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex min-h-[200px] items-center justify-center">
        <Spinner className="size-6" />
      </div>
    </div>
  );
}

function AddDomainSubscriptionError({
  className,
  onClose,
  onRetry,
  isRetrying,
}: {
  className?: string;
  onClose?: () => void;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <div className={className}>
      <div className="mb-4 flex flex-col items-center text-center">
        <Icon size="lg" variant="destructive" className="mb-2">
          <IconAlertCircle />
        </Icon>
        <h2 className="text-lg leading-none font-semibold tracking-tight">
          Unable to Load Subscription
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We couldn&apos;t load your subscription details. Please try again.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Button onClick={onRetry} disabled={isRetrying} className="w-full">
          Retry
        </Button>
        {onClose ? (
          <Button variant="outline" onClick={onClose} className="w-full">
            Close
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function AddDomainQuotaReached({
  className,
  onClose,
  subscription,
  isPro,
}: {
  className?: string;
  onClose?: () => void;
  subscription?: Pick<SubscriptionQuota, "activeCount" | "planQuota" | "endsAt">;
  isPro: boolean;
}) {
  return (
    <div className={className}>
      <div className="mb-4 flex flex-col items-center gap-1 text-center">
        <Icon size="lg" variant="destructive" className="mb-2">
          <IconGauge />
        </Icon>
        <h2 className="text-lg font-semibold tracking-tight">Domain Limit Reached</h2>
        <p className="text-sm text-muted-foreground">
          You&apos;ve reached your limit of {subscription?.planQuota} tracked domain
          {subscription?.planQuota !== 1 ? "s" : ""}.
        </p>
      </div>

      <div className="space-y-4">
        {subscription ? (
          <PlanStatusCard
            activeCount={subscription.activeCount}
            planQuota={subscription.planQuota}
            isPro={isPro}
            endsAt={subscription.endsAt}
          />
        ) : null}

        {isPro ? (
          <div className="flex flex-col gap-2">
            <p className="text-center text-sm text-muted-foreground">
              You can archive unused domains to make room for new ones, or remove domains you no
              longer need to track.
            </p>
            {onClose ? (
              <Button variant="outline" onClick={onClose} className="w-full">
                Close
              </Button>
            ) : null}
          </div>
        ) : (
          <UpgradeCard />
        )}
      </div>
    </div>
  );
}

function AddDomainVerifyForm({
  method,
  setMethod,
  domain,
  verificationToken,
  verificationState,
  onVerify,
  onReturnLater,
  trackedDomainId,
  isVerifying,
}: {
  method: VerificationMethod;
  setMethod: (method: VerificationMethod) => void;
  domain: string;
  verificationToken: string;
  verificationState: VerificationState;
  onVerify: () => void;
  onReturnLater: () => void;
  trackedDomainId: string;
  isVerifying: boolean;
}) {
  return (
    <>
      <StepVerifyOwnership
        method={method}
        setMethod={setMethod}
        domain={domain}
        verificationToken={verificationToken}
        verificationState={verificationState}
        onVerify={onVerify}
        onReturnLater={onReturnLater}
      />

      <div className="mt-6 flex w-full items-center justify-between gap-2">
        <div className="flex-1">
          <ShareInstructionsDialog
            domain={domain}
            verificationToken={verificationToken}
            trackedDomainId={trackedDomainId}
          />
        </div>
        <Button onClick={onVerify} disabled={isVerifying}>
          {isVerifying ? <Spinner /> : <IconCheck />}
          {isVerifying ? "Checking…" : "Check Now"}
        </Button>
      </div>
    </>
  );
}

type AddDomainVerifyStepProps = {
  method: VerificationMethod;
  setMethod: (method: VerificationMethod) => void;
  domain: string;
  verificationToken: string;
  verificationState: VerificationState;
  onVerify: () => void;
  onReturnLater: () => void;
  trackedDomainId: string | null;
  isVerifying: boolean;
  isLoadingVerificationData: boolean;
  isMissingVerificationData: boolean;
  isVerificationDataQueryError: boolean;
  verificationDataErrorMessage?: string;
  isRefetchingVerificationData: boolean;
  onRetryVerificationData: () => void;
};

function AddDomainVerifyStep({
  method,
  setMethod,
  domain,
  verificationToken,
  verificationState,
  onVerify,
  onReturnLater,
  trackedDomainId,
  isVerifying,
  isLoadingVerificationData,
  isMissingVerificationData,
  isVerificationDataQueryError,
  verificationDataErrorMessage,
  isRefetchingVerificationData,
  onRetryVerificationData,
}: AddDomainVerifyStepProps) {
  if (isLoadingVerificationData) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (isMissingVerificationData) {
    return (
      <StepInstructionsError
        error={
          isVerificationDataQueryError
            ? verificationDataErrorMessage
            : "Verification details could not be loaded."
        }
        onRetry={onRetryVerificationData}
        isRetrying={isRefetchingVerificationData}
      />
    );
  }

  if (!verificationToken || !trackedDomainId) {
    return null;
  }

  return (
    <AddDomainVerifyForm
      method={method}
      setMethod={setMethod}
      domain={domain}
      verificationToken={verificationToken}
      verificationState={verificationState}
      onVerify={onVerify}
      onReturnLater={onReturnLater}
      trackedDomainId={trackedDomainId}
      isVerifying={isVerifying}
    />
  );
}

function addDomainHeading(isResuming: boolean, domain: string) {
  if (isResuming) {
    return {
      title: "Complete Verification",
      description: domain ? `Verify ownership of ${domain}` : "Verify ownership",
    };
  }

  return {
    title: "Add Domain",
    description: "Track and monitor your domain",
  };
}

type AddDomainStepperProps = {
  className?: string;
  isNavigating: boolean;
  step: 1 | 2 | 3;
  domain: string;
  setDomain: (domain: string) => void;
  domainError: string;
  isAddingDomain: boolean;
  onAddDomain: () => void;
  onDone: () => void;
  isPrefilled: boolean;
  isResuming: boolean;
} & AddDomainVerifyStepProps;

function AddDomainStepper({
  className,
  isNavigating,
  step,
  domain,
  setDomain,
  domainError,
  isAddingDomain,
  onAddDomain,
  onDone,
  isPrefilled,
  isResuming,
  ...verify
}: AddDomainStepperProps) {
  const heading = addDomainHeading(isResuming, domain);

  return (
    <div className={className}>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{heading.title}</h2>
        <p className="text-sm text-muted-foreground">{heading.description}</p>
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
          <StepperItem step={2} loading={verify.isLoadingVerificationData || verify.isVerifying}>
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
          <StepperItem step={3} loading={isNavigating}>
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
          <StepperContent value={1} className="flex min-h-[200px] flex-col justify-between">
            <StepEnterDomain
              domain={domain}
              setDomain={setDomain}
              error={domainError}
              isLoading={isAddingDomain}
              onSubmit={onAddDomain}
              readOnly={isPrefilled}
            />
            <div className="mt-6 flex w-full items-center justify-end">
              <Button onClick={onAddDomain} disabled={isAddingDomain}>
                {isAddingDomain ? <Spinner /> : null}
                Continue
              </Button>
            </div>
          </StepperContent>

          <StepperContent value={2}>
            <AddDomainVerifyStep {...verify} domain={domain} />
          </StepperContent>

          <StepperContent value={3}>
            <StepConfirmation domain={domain} />
            <div className="mt-6 flex w-full items-center justify-end">
              <Button onClick={onDone} disabled={isNavigating}>
                {isNavigating ? <Spinner /> : null}
                Done
              </Button>
            </div>
          </StepperContent>
        </StepperPanel>
      </Stepper>
    </div>
  );
}

function AddDomainContentInner({
  className,
  onClose,
  onSuccess,
  isNavigating = false,
  resumeDomain,
  prefillDomain,
}: AddDomainContentProps) {
  const { subscription, isPro, isSubscriptionLoading, isSubscriptionError, refetchSubscription } =
    useSubscription();

  const verification = useDomainVerification({
    onSuccess,
    onClose,
    resumeDomain,
    prefillDomain,
  });

  if (isSubscriptionLoading) {
    return <AddDomainLoading className={className} />;
  }

  if (isSubscriptionError) {
    return (
      <AddDomainSubscriptionError
        className={className}
        onClose={onClose}
        onRetry={() => refetchSubscription()}
        isRetrying={isSubscriptionLoading}
      />
    );
  }

  if (!subscription?.canAddMore && !resumeDomain && verification.step !== 3) {
    return (
      <AddDomainQuotaReached
        className={className}
        onClose={onClose}
        subscription={subscription}
        isPro={isPro}
      />
    );
  }

  return (
    <AddDomainStepper
      className={className}
      isNavigating={isNavigating}
      step={verification.step}
      domain={verification.domain}
      setDomain={verification.setDomain}
      domainError={verification.domainError}
      isAddingDomain={verification.isAddingDomain}
      onAddDomain={() => void verification.handleAddDomain()}
      onDone={verification.handleDone}
      isPrefilled={verification.isPrefilled}
      isResuming={verification.isResuming}
      method={verification.method}
      setMethod={verification.setMethod}
      verificationToken={verification.verificationToken}
      verificationState={verification.verificationState}
      onVerify={() => void verification.handleVerify()}
      onReturnLater={verification.handleReturnLater}
      trackedDomainId={verification.trackedDomainId}
      isVerifying={verification.isVerifying}
      isLoadingVerificationData={verification.isLoadingVerificationData}
      isMissingVerificationData={verification.isMissingVerificationData}
      isVerificationDataQueryError={verification.isVerificationDataQueryError}
      verificationDataErrorMessage={verification.verificationDataErrorMessage}
      isRefetchingVerificationData={verification.isRefetchingVerificationData}
      onRetryVerificationData={() => void verification.refetchVerificationData()}
    />
  );
}

export function AddDomainContent(props: AddDomainContentProps) {
  const flowKey = props.resumeDomain?.id ?? props.prefillDomain ?? "new";
  return <AddDomainContentInner key={flowKey} {...props} />;
}
