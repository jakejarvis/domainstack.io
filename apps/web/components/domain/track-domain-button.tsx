import {
  IconAlertCircle,
  IconBellPlus,
  IconRosetteDiscountCheck,
} from "@tabler/icons-react";
import Link from "next/link";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
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
      <Button variant="outline" disabled aria-label="Track domain">
        <IconBellPlus className="sm:text-muted-foreground" aria-hidden="true" />
        <span className="hidden sm:inline">Track</span>
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
              nativeButton={false}
              aria-label="View in dashboard"
              render={
                <Link href="/dashboard">
                  <IconRosetteDiscountCheck
                    className="text-success-foreground"
                    aria-hidden="true"
                  />
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

  // Determine button content based on tracking status
  const buttonContent = isPendingVerification ? (
    <>
      <IconAlertCircle className="text-accent-orange" aria-hidden="true" />
      <span className="hidden sm:inline">Verify</span>
    </>
  ) : (
    <>
      <IconBellPlus className="sm:text-muted-foreground" aria-hidden="true" />
      <span className="hidden sm:inline">Track</span>
    </>
  );

  const tooltipText = isPendingVerification
    ? "Complete verification for this domain"
    : "Get alerts for this domain";

  const ariaLabel = isPendingVerification ? "Verify domain" : "Track domain";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          session?.user ? (
            <Button
              variant="outline"
              onClick={handleButtonClick}
              aria-label={ariaLabel}
            >
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
          )
        }
      />
      <TooltipContent>
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}
