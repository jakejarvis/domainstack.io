"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { AddDomainContent } from "@/components/dashboard/add-domain/add-domain-content";
import { useRouter } from "@/hooks/use-router";
import { parseResumeDomain } from "@/lib/add-domain-resume";

export function AddDomainModalClient({ prefillDomain }: { prefillDomain?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleClose = () => {
    router.back();
  };

  const handleSuccess = () => {
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
