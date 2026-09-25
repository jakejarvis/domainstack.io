"use client";

import { IconAlertCircle, IconBellPlus, IconRosetteDiscountCheck } from "@tabler/icons-react";
import { skipToken, useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { LinkPendingIcon } from "@/components/link-pending-icon";
import { addDomainResumeHref } from "@/lib/add-domain-resume";
import { useTRPC } from "@/lib/trpc/client";
import { useSession } from "@domainstack/auth/client";
import { Button } from "@domainstack/ui/button";
import { useIsClient } from "@domainstack/ui/hooks";
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
  href,
}: {
  isPendingVerification: boolean;
  href: string;
}) {
  const label = isPendingVerification ? "Verify" : "Track";
  const icon = isPendingVerification ? (
    <IconAlertCircle className="text-accent-orange" aria-hidden="true" />
  ) : (
    <IconBellPlus className="sm:text-muted-foreground" aria-hidden="true" />
  );
  const tooltipText = isPendingVerification
    ? "Complete verification for this domain"
    : "Get alerts for this domain";
  const ariaLabel = isPendingVerification ? "Verify domain" : "Track domain";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            nativeButton={false}
            aria-label={ariaLabel}
            render={
              <Link href={href} scroll={false}>
                <LinkPendingIcon icon={icon} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            }
          />
        }
      />
      <TooltipContent>
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function TrackDomainButton({ domain, enabled = true }: TrackDomainButtonProps) {
  const { data: session, isPending: isSessionPending } = useSession();
  const trpc = useTRPC();
  const mounted = useIsClient();

  const isAuthenticated = !!session?.user;
  const { data: trackedDomain, isLoading: isLoadingStatus } = useQuery(
    trpc.tracking.getTrackingStatus.queryOptions(isAuthenticated ? { domain } : skipToken),
  );

  const isTracked = !!trackedDomain;
  const isVerified = trackedDomain?.verified ?? false;
  const isPendingVerification = isTracked && !isVerified;

  if (!mounted || isSessionPending || !enabled || (session?.user && isLoadingStatus)) {
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

  let href = "/login";
  if (isAuthenticated) {
    href =
      isPendingVerification && trackedDomain
        ? addDomainResumeHref(trackedDomain.id, trackedDomain.verificationMethod)
        : `/dashboard/add-domain?domain=${encodeURIComponent(domain)}`;
  }

  return <TrackOrVerifyButton isPendingVerification={isPendingVerification} href={href} />;
}
