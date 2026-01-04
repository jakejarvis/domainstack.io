import { AlertCircle, BadgeCheck, BellPlus } from "lucide-react";
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
};

export function TrackDomainButton({ domain }: TrackDomainButtonProps) {
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

  // Show loading state during SSR, initial hydration, or while data is loading
  // This ensures consistent rendering between server and client
  if (isSessionPending || (session?.user && isLoadingDomains)) {
    return (
      <Button variant="outline" disabled>
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
              nativeButton={false}
              render={
                <Link href="/dashboard">
                  <BadgeCheck className="text-success-foreground" />
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
      <AlertCircle className="text-accent-orange" />
      <span className="hidden sm:inline">Verify</span>
    </>
  ) : (
    <>
      <BellPlus className="text-accent-gold" />
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
            <Button variant="outline" onClick={handleButtonClick}>
              {buttonContent}
            </Button>
          ) : (
            <Button
              variant="outline"
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
