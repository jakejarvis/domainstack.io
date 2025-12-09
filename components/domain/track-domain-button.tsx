"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, BellPlus, Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
  const [resumeDomain, setResumeDomain] = useState<ResumeDomainData | null>(
    null,
  );

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

  // Handle success from add dialog - invalidate the tracked domains query
  const handleAddSuccess = () => {
    void queryClient.invalidateQueries({
      queryKey: trpc.tracking.listDomains.queryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: trpc.tracking.getLimits.queryKey(),
    });
  };

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

  // Tracked but pending verification - show info state with option to resume
  if (isPendingVerification && trackedDomain) {
    const handleResume = () => {
      setResumeDomain({
        id: trackedDomain.id,
        domainName: trackedDomain.domainName,
        verificationToken: trackedDomain.verificationToken,
      });
      setAddDialogOpen(true);
    };

    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={handleResume}
              className="cursor-pointer"
            >
              <Check className="size-4 text-accent-green" />
              <span className="hidden sm:inline">Verify</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Complete verification for this domain</p>
          </TooltipContent>
        </Tooltip>

        <AddDomainDialog
          open={addDialogOpen}
          onOpenChange={(open) => {
            setAddDialogOpen(open);
            if (!open) setResumeDomain(null);
          }}
          onSuccess={handleAddSuccess}
          resumeDomain={resumeDomain}
        />
      </>
    );
  }

  // Not tracked - show track button
  // For logged-out users, use hybrid Link/modal pattern (ctrl+click goes to /login)
  const handleClick = (e: React.MouseEvent) => {
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
  };

  const buttonContent = (
    <>
      <BellPlus className="size-4 text-accent-gold" />
      <span className="hidden sm:inline">Track</span>
    </>
  );

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          {session?.user ? (
            <Button
              variant="outline"
              onClick={handleClick}
              className="cursor-pointer"
            >
              {buttonContent}
            </Button>
          ) : (
            <Button asChild variant="outline" className="cursor-pointer">
              <Link
                href="/login"
                onClick={handleClick}
                data-disable-progress={true}
              >
                {buttonContent}
              </Link>
            </Button>
          )}
        </TooltipTrigger>
        <TooltipContent>
          <p>Get alerts for this domain</p>
        </TooltipContent>
      </Tooltip>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />

      <AddDomainDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={handleAddSuccess}
        prefillDomain={domain}
      />
    </>
  );
}
