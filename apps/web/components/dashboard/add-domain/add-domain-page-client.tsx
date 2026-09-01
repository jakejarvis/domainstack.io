"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";

import { AddDomainContent } from "@/components/dashboard/add-domain/add-domain-content";
import { useRouter } from "@/hooks/use-router";
import { parseResumeDomain } from "@/lib/add-domain-resume";
import { useTRPC } from "@/lib/trpc/client";
import { Card } from "@domainstack/ui/card";

export function AddDomainPageClient({ prefillDomain }: { prefillDomain?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isNavigating, startNavigation] = useTransition();

  const handleSuccess = () => {
    // Invalidate queries to refresh the list and subscription status
    void queryClient.invalidateQueries(trpc.tracking.listDomains.queryFilter());
    void queryClient.invalidateQueries(trpc.user.getSubscription.queryFilter());
    startNavigation(() => router.push("/dashboard", { scroll: false }));
  };

  const resumeDomain = useMemo(() => parseResumeDomain(searchParams), [searchParams]);

  return (
    <Card className="w-full px-6">
      <AddDomainContent
        onSuccess={handleSuccess}
        isNavigating={isNavigating}
        prefillDomain={prefillDomain}
        resumeDomain={resumeDomain}
      />
    </Card>
  );
}
