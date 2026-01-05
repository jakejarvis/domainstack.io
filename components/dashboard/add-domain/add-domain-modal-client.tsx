"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { AddDomainContent } from "@/components/dashboard/add-domain/add-domain-content";
import type { ResumeDomainData } from "@/hooks/use-domain-verification";
import { useRouter } from "@/hooks/use-router";
import { isValidVerificationMethod } from "@/lib/constants/verification";
import { useTRPC } from "@/lib/trpc/client";

export function AddDomainModalClient({
  prefillDomain,
}: {
  prefillDomain?: string;
}) {
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

  const resumeDomain = useMemo<ResumeDomainData | null>(() => {
    const isResume = searchParams.get("resume") === "true";
    const id = searchParams.get("id");
    const domain = searchParams.get("domain");
    const methodParam = searchParams.get("method");

    // Validate verification method at runtime without Zod
    const method = isValidVerificationMethod(methodParam) ? methodParam : null;

    if (isResume && id) {
      return {
        id,
        // Optional: fallback to empty string if not in params,
        // will be populated by useDomainVerification fetching verification data
        domainName: domain ?? "",
        // Token is not needed here as it will be fetched from the server
        verificationToken: "",
        verificationMethod: method,
      };
    }

    return null;
  }, [searchParams]);

  return (
    <AddDomainContent
      onClose={handleClose}
      onSuccess={handleSuccess}
      prefillDomain={prefillDomain}
      resumeDomain={resumeDomain}
    />
  );
}
