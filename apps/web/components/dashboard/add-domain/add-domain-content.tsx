import { IconAlertCircle, IconCheck, IconGauge } from "@tabler/icons-react";
import Link from "next/link";

import { ShareInstructionsDialog } from "@/components/dashboard/add-domain/share-instructions-dialog";
import { StepConfirmation } from "@/components/dashboard/add-domain/step-confirmation";
import { StepEnterDomain } from "@/components/dashboard/add-domain/step-enter-domain";
import { StepInstructionsError } from "@/components/dashboard/add-domain/step-instructions-error";
import { StepVerifyOwnership } from "@/components/dashboard/add-domain/step-verify-ownership";
import { ProUpsell } from "@/components/plan-cards";
import { useDomainVerification } from "@/hooks/use-domain-verification";
import { useSubscription } from "@/hooks/use-subscription";
import type { ResumeDomainData } from "@domainstack/types";
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
  planQuota,
  isPro,
}: {
  className?: string;
  onClose?: () => void;
  planQuota?: number;
  isPro: boolean;
}) {
  return (
    <div className={className}>
      <div className="mb-4 flex items-start gap-3">
        <Icon size="sm" variant="warning" className="-mt-1">
          <IconGauge />
        </Icon>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Domain limit reached</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            You&apos;re tracking all <span className="tabular-nums">{planQuota}</span> domains
            included with {isPro ? "Pro" : "Free"}.{" "}
            {isPro
              ? "Archive or remove one you no longer need."
              : "Archive one you no longer need, or upgrade for more."}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {isPro ? null : <ProUpsell className="mb-2" />}
        {onClose ? (
          <Button variant="ghost" onClick={onClose} className="w-full">
            Back to domains
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="w-full"
            nativeButton={false}
            render={<Link href="/dashboard">Back to domains</Link>}
          />
        )}
      </div>
    </div>
  );
}

type DomainVerification = ReturnType<typeof useDomainVerification>;

function AddDomainVerifyStep({ verification }: { verification: DomainVerification }) {
  const { domain, verificationToken, trackedDomainId, isVerifying } = verification;

  if (verification.isLoadingVerificationData) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (verification.isMissingVerificationData) {
    return (
      <StepInstructionsError
        error={
          verification.isVerificationDataQueryError
            ? verification.verificationDataErrorMessage
            : "Verification details could not be loaded."
        }
        onRetry={() => void verification.refetchVerificationData()}
        isRetrying={verification.isRefetchingVerificationData}
      />
    );
  }

  if (!verificationToken || !trackedDomainId) {
    return null;
  }

  const onVerify = () => void verification.handleVerify();

  return (
    <>
      <StepVerifyOwnership
        method={verification.method}
        setMethod={verification.setMethod}
        domain={domain}
        verificationToken={verificationToken}
        verificationState={verification.verificationState}
        onVerify={onVerify}
        onReturnLater={verification.handleReturnLater}
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

function AddDomainStepper({
  className,
  isNavigating,
  verification,
}: {
  className?: string;
  isNavigating: boolean;
  verification: DomainVerification;
}) {
  const { domain, isAddingDomain } = verification;
  const onAddDomain = () => void verification.handleAddDomain();
  const heading = addDomainHeading(verification.isResuming, domain);

  return (
    <div className={className}>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{heading.title}</h2>
        <p className="text-sm text-muted-foreground">{heading.description}</p>
      </div>

      <Stepper
        value={verification.step}
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
            loading={verification.isLoadingVerificationData || verification.isVerifying}
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
              setDomain={verification.setDomain}
              error={verification.domainError}
              isLoading={isAddingDomain}
              onSubmit={onAddDomain}
              readOnly={verification.isPrefilled}
            />
            <div className="mt-6 flex w-full items-center justify-end">
              <Button onClick={onAddDomain} disabled={isAddingDomain}>
                {isAddingDomain ? <Spinner /> : null}
                Continue
              </Button>
            </div>
          </StepperContent>

          <StepperContent value={2}>
            <AddDomainVerifyStep verification={verification} />
          </StepperContent>

          <StepperContent value={3}>
            <StepConfirmation domain={domain} />
            <div className="mt-6 flex w-full items-center justify-end">
              <Button onClick={verification.handleDone} disabled={isNavigating}>
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
        planQuota={subscription?.planQuota}
        isPro={isPro}
      />
    );
  }

  return (
    <AddDomainStepper
      className={className}
      isNavigating={isNavigating}
      verification={verification}
    />
  );
}

export function AddDomainContent(props: AddDomainContentProps) {
  const flowKey = props.resumeDomain?.id ?? props.prefillDomain ?? "new";
  return <AddDomainContentInner key={flowKey} {...props} />;
}
