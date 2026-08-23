"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { AddDomainContent } from "@/components/dashboard/add-domain/add-domain-content";
import { useRouter } from "@/hooks/use-router";
import { parseResumeDomain } from "@/lib/add-domain-resume";
import { useTRPC } from "@/lib/trpc/client";

export function AddDomainModalClient({ prefillDomain }: { prefillDomain?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const handleClose = () => {
    router.back();
  };

  const handleSuccess = () => {
    // Invalidate queries to refresh the list and subscription status
    void queryClient.invalidateQueries({
      queryKey: trpc.tracking.listDomains.queryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: trpc.user.getSubscription.queryKey(),
    });
    router.back();
  };

  const resumeDomain = useMemo(() => parseResumeDomain(searchParams), [searchParams]);

  return (
    <AddDomainContent
      onClose={handleClose}
      onSuccess={handleSuccess}
      prefillDomain={prefillDomain}
      resumeDomain={resumeDomain}
    />
  );
}
