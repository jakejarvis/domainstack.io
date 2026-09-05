"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";

import { AddDomainContent } from "@/components/dashboard/add-domain/add-domain-content";
import { useRouter } from "@/hooks/use-router";
import { parseResumeDomain } from "@/lib/add-domain-resume";
import { Card } from "@domainstack/ui/card";

export function AddDomainPageClient({ prefillDomain }: { prefillDomain?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isNavigating, startNavigation] = useTransition();

  const handleSuccess = () => {
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
