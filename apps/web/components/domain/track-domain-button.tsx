"use client";

import { IconAlertCircle, IconBellPlus, IconRosetteDiscountCheck } from "@tabler/icons-react";
import { skipToken, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useTransition } from "react";

import { useIsClient } from "@/hooks/use-is-client";
import { useRouter } from "@/hooks/use-router";
import { useTRPC } from "@/lib/trpc/client";
import { useSession } from "@domainstack/auth/client";
import { Button } from "@domainstack/ui/button";
import { Spinner } from "@domainstack/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@domainstack/ui/tooltip";

type TrackDomainButtonProps = {
  domain: string;
  /** Whether the button is enabled. Defaults to true. */
  enabled?: boolean;
};

function TrackedVerifiedButton() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            nativeButton={false}
            aria-label="View in dashboard"
            render={
              <Link href="/dashboard">
                <IconRosetteDiscountCheck className="text-success-foreground" aria-hidden="true" />
                <span className="sr-only">View in dashboard</span>
              </Link>
            }
          />
        }
      />
      <TooltipContent>You own and track this domain</TooltipContent>
    </Tooltip>
  );
}

function TrackOrVerifyButton({
  isPendingVerification,
  isAuthenticated,
  isNavigating,
  onClick,
}: {
  isPendingVerification: boolean;
  isAuthenticated: boolean;
  isNavigating: boolean;
  onClick: () => void;
}) {
  const label = isPendingVerification ? "Verify" : "Track";
  const icon = isPendingVerification ? (
    <IconAlertCircle className="text-accent-orange" aria-hidden="true" />
  ) : (
    <IconBellPlus className="sm:text-muted-foreground" aria-hidden="true" />
  );
  const buttonContent = (
    <>
      {isNavigating ? <Spinner /> : icon}
      <span className="hidden sm:inline">{label}</span>
    </>
  );
  const tooltipText = isPendingVerification
    ? "Complete verification for this domain"
    : "Get alerts for this domain";
  const ariaLabel = isPendingVerification ? "Verify domain" : "Track domain";

  const trigger = isAuthenticated ? (
    <Button variant="outline" onClick={onClick} disabled={isNavigating} aria-label={ariaLabel}>
      {buttonContent}
    </Button>
  ) : (
    <Button
      variant="outline"
      nativeButton={false}
      aria-label={ariaLabel}
      render={
        <Link href="/login" scroll={false}>
          {buttonContent}
        </Link>
      }
    />
  );

  return (
    <Tooltip>
      <TooltipTrigger render={trigger} />
      <TooltipContent>
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function TrackDomainButton({ domain, enabled = true }: TrackDomainButtonProps) {
  const { data: session, isPending: isSessionPending } = useSession();
  const router = useRouter();
  const trpc = useTRPC();
  const [isNavigating, startNavigation] = useTransition();
  const mounted = useIsClient();

  const isAuthenticated = !!session?.user;
  const { data: trackedDomains, isLoading: isLoadingDomains } = useQuery(
    trpc.tracking.listDomains.queryOptions(
      isAuthenticated ? { includeArchived: false } : skipToken,
    ),
  );

  const trackedDomain = trackedDomains?.find(
    (d) => d.domainName.toLowerCase() === domain.toLowerCase(),
  );
  const isTracked = !!trackedDomain;
  const isVerified = trackedDomain?.verified ?? false;
  const isPendingVerification = isTracked && !isVerified;

  const handleButtonClick = useCallback(() => {
    if (!session?.user) return;

    if (isPendingVerification && trackedDomain) {
      const params = new URLSearchParams({
        resume: "true",
        id: trackedDomain.id,
      });

      if (trackedDomain.verificationMethod) {
        params.set("method", trackedDomain.verificationMethod);
      }

      startNavigation(() =>
        router.push(`/dashboard/add-domain?${params.toString()}`, {
          scroll: false,
        }),
      );
      return;
    }

    startNavigation(() =>
      router.push(`/dashboard/add-domain?domain=${encodeURIComponent(domain)}`, {
        scroll: false,
      }),
    );
  }, [session?.user, isPendingVerification, trackedDomain, domain, router, startNavigation]);

  if (!mounted || isSessionPending || !enabled || (session?.user && isLoadingDomains)) {
    return (
      <Button variant="outline" disabled aria-label="Track domain">
        <IconBellPlus className="sm:text-muted-foreground" aria-hidden="true" />
        <span className="hidden sm:inline">Track</span>
      </Button>
    );
  }

  if (isTracked && isVerified) {
    return <TrackedVerifiedButton />;
  }

  return (
    <TrackOrVerifyButton
      isPendingVerification={isPendingVerification}
      isAuthenticated={isAuthenticated}
      isNavigating={isNavigating}
      onClick={handleButtonClick}
    />
  );
}
