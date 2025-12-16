"use client";

import { AlertCircle, BadgeCheck, BellPlus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LoginDialog } from "@/components/auth/login-dialog";
import {
  AddDomainDialog,
  type ResumeDomainData,
} from "@/components/dashboard/add-domain/add-domain-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSubscription } from "@/hooks/use-subscription";
import { useTrackedDomains } from "@/hooks/use-tracked-domains";
import { useSession } from "@/lib/auth-client";

type TrackDomainButtonProps = {
  domain: string;
};

export function TrackDomainButton({ domain }: TrackDomainButtonProps) {
  const { data: session, isPending: isSessionPending } = useSession();
  const [loginOpen, setLoginOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Track mounted state to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Only query subscription and tracked domains when user is authenticated
  const isAuthenticated = !!session?.user;
  const { invalidate: invalidateSubscription } = useSubscription({
    enabled: isAuthenticated,
  });
  const {
    domains: trackedDomains,
    isLoading: isLoadingDomains,
    invalidate: invalidateTrackedDomains,
  } = useTrackedDomains({ enabled: isAuthenticated });

  // Find if this domain is already tracked
  const trackedDomain = trackedDomains?.find(
    (d) => d.domainName.toLowerCase() === domain.toLowerCase(),
  );
  const isTracked = !!trackedDomain;
  const isVerified = trackedDomain?.verified ?? false;
  const isPendingVerification = isTracked && !isVerified;

  // Compute resumeDomain from the tracked domain when pending verification
  // This is derived state, not stored in useState, to avoid stale state issues
  const resumeDomain: ResumeDomainData | null = useMemo(() => {
    if (isPendingVerification && trackedDomain) {
      return {
        id: trackedDomain.id,
        domainName: trackedDomain.domainName,
        verificationToken: trackedDomain.verificationToken,
        verificationMethod: trackedDomain.verificationMethod,
      };
    }
    return null;
  }, [isPendingVerification, trackedDomain]);

  // Handle success from add dialog - invalidate the tracked domains query
  const handleAddSuccess = useCallback(() => {
    invalidateTrackedDomains();
    invalidateSubscription();
  }, [invalidateTrackedDomains, invalidateSubscription]);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setAddDialogOpen(open);
  }, []);

  const handleButtonClick = useCallback(
    (e: React.MouseEvent) => {
      if (session?.user) {
        // Logged in - open add domain dialog
        setAddDialogOpen(true);
        return;
      }
      // Logged out - open login modal (unless modifier key pressed)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) {
        return; // Let link work normally
      }
      e.preventDefault();
      setLoginOpen(true);
    },
    [session?.user],
  );

  // Show loading state during SSR, initial hydration, or while data is loading
  // This ensures consistent rendering between server and client
  if (!mounted || isSessionPending || (session?.user && isLoadingDomains)) {
    return (
      <Button variant="outline" disabled>
        <Spinner className="size-4" />
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
              className="text-success-foreground"
              render={<Link href="/dashboard" prefetch={false} />}
            >
              <BadgeCheck className="size-4" />
            </Button>
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
      <AlertCircle className="size-4 text-accent-orange" />
      <span className="hidden sm:inline">Verify</span>
    </>
  ) : (
    <>
      <BellPlus className="size-4 text-accent-gold" />
      <span className="hidden sm:inline">Track</span>
    </>
  );

  const tooltipText = isPendingVerification
    ? "Complete verification for this domain"
    : "Get alerts for this domain";

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            session?.user ? (
              <Button
                variant="outline"
                onClick={handleButtonClick}
                className="cursor-pointer"
              >
                {buttonContent}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="cursor-pointer"
                render={
                  <Link
                    href="/login"
                    prefetch={false}
                    onClick={handleButtonClick}
                    data-disable-progress={true}
                  />
                }
              >
                {buttonContent}
              </Button>
            )
          }
        />
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />

      {/* Single dialog instance - uses resumeDomain when pending, prefillDomain otherwise */}
      <AddDomainDialog
        open={addDialogOpen}
        onOpenChange={handleDialogOpenChange}
        onSuccess={handleAddSuccess}
        resumeDomain={resumeDomain}
        prefillDomain={domain}
      />
    </>
  );
}
