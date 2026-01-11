import {
  SealCheckIcon,
  TargetIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRouter } from "@/hooks/use-router";
import { useTrackedDomains } from "@/hooks/use-tracked-domains";
import { useSession } from "@/lib/auth-client";

type TrackDomainButtonProps = {
  domain: string;
  /** Whether the button is enabled. Defaults to true. */
  enabled?: boolean;
};

export function TrackDomainButton({
  domain,
  enabled = true,
}: TrackDomainButtonProps) {
  const { data: session, isPending: isSessionPending } = useSession();
  const router = useRouter();

  // Only query tracked domains when user is authenticated
  const isAuthenticated = !!session?.user;
  const { domains: trackedDomains, isLoading: isLoadingDomains } =
    useTrackedDomains({ enabled: isAuthenticated });

  // Find if this domain is already tracked
  const trackedDomain = trackedDomains?.find(
    (d) => d.domainName.toLowerCase() === domain.toLowerCase(),
  );
  const isTracked = !!trackedDomain;
  const isVerified = trackedDomain?.verified ?? false;
  const isPendingVerification = isTracked && !isVerified;

  const handleButtonClick = useCallback(() => {
    if (session?.user) {
      if (isPendingVerification && trackedDomain) {
        // Navigate to add-domain with resume params (only ID is required)
        const params = new URLSearchParams({
          resume: "true",
          id: trackedDomain.id,
        });

        if (trackedDomain.verificationMethod) {
          params.set("method", trackedDomain.verificationMethod);
        }

        router.push(`/dashboard/add-domain?${params.toString()}`, {
          scroll: false,
        });
      } else {
        // Add new domain flow
        router.push(
          `/dashboard/add-domain?domain=${encodeURIComponent(domain)}`,
          { scroll: false },
        );
      }
    }
  }, [session?.user, isPendingVerification, trackedDomain, domain, router]);

  // Show loading state during SSR, initial hydration, while data is loading,
  // or while the button is disabled (e.g., waiting for registration confirmation)
  // This ensures consistent rendering between server and client
  if (isSessionPending || !enabled || (session?.user && isLoadingDomains)) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Spinner />
      </Button>
    );
  }

  // Already tracked and verified - show success state
  if (isTracked && isVerified) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <Link href="/dashboard">
                  <SealCheckIcon className="text-success-foreground" />
                  <span className="hidden">View in dashboard</span>
                </Link>
              }
            />
          }
        />
        <TooltipContent>
          <p>You own and track this domain</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Determine button content based on tracking status
  const buttonContent = isPendingVerification ? (
    <>
      <WarningCircleIcon className="text-accent-orange" />
      <span className="hidden sm:inline">Verify</span>
    </>
  ) : (
    <>
      <TargetIcon className="text-accent-purple" />
      <span className="hidden sm:inline">Track</span>
    </>
  );

  const tooltipText = isPendingVerification
    ? "Complete verification for this domain"
    : "Get alerts for this domain";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          session?.user ? (
            <Button variant="outline" size="sm" onClick={handleButtonClick}>
              {buttonContent}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <Link href="/login" scroll={false}>
                  {buttonContent}
                </Link>
              }
            />
          )
        }
      />
      <TooltipContent>
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}
