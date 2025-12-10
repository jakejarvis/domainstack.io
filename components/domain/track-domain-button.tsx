"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, BellPlus, Check } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
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
import { useSession } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc/client";

type TrackDomainButtonProps = {
  domain: string;
};

export function TrackDomainButton({ domain }: TrackDomainButtonProps) {
  const { data: session, isPending: isSessionPending } = useSession();
  const [loginOpen, setLoginOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Only fetch tracked domains when logged in
  const { data: trackedDomains, isLoading: isLoadingDomains } = useQuery({
    ...trpc.tracking.listDomains.queryOptions(),
    enabled: !!session?.user,
  });

  // Find if this domain is already tracked
  const trackedDomain = trackedDomains?.items.find(
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
      };
    }
    return null;
  }, [isPendingVerification, trackedDomain]);

  // Handle success from add dialog - invalidate the tracked domains query
  const handleAddSuccess = useCallback(() => {
    // Use partial matching to invalidate all listDomains queries (including infinite queries with different inputs)
    void queryClient.invalidateQueries({
      queryKey: trpc.tracking.listDomains.queryKey(),
      exact: false,
    });
    void queryClient.invalidateQueries({
      queryKey: trpc.tracking.getLimits.queryKey(),
    });
  }, [queryClient, trpc]);

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

  // Show loading state while session or domains are loading
  if (isSessionPending || (session?.user && isLoadingDomains)) {
    return (
      <Button variant="outline" size="icon" disabled>
        <Spinner className="size-4" />
      </Button>
    );
  }

  // Already tracked and verified - show success state
  if (isTracked && isVerified) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            asChild
            className="text-success-foreground"
          >
            <Link href="/dashboard">
              <BadgeCheck className="size-4" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>You own and track this domain</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Determine button content based on tracking status
  const buttonContent = isPendingVerification ? (
    <>
      <Check className="size-4 text-accent-green" />
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
        <TooltipTrigger asChild>
          {session?.user ? (
            <Button
              variant="outline"
              onClick={handleButtonClick}
              className="cursor-pointer"
            >
              {buttonContent}
            </Button>
          ) : (
            <Button asChild variant="outline" className="cursor-pointer">
              <Link
                href="/login"
                onClick={handleButtonClick}
                data-disable-progress={true}
              >
                {buttonContent}
              </Link>
            </Button>
          )}
        </TooltipTrigger>
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
