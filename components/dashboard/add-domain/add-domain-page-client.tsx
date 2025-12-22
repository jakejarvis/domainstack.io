"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { AddDomainContent } from "@/components/dashboard/add-domain/add-domain-content";
import { Card } from "@/components/ui/card";
import type { ResumeDomainData } from "@/hooks/use-domain-verification";
import { useRouter } from "@/hooks/use-router";
import { isValidVerificationMethod } from "@/lib/constants";

export function AddDomainPageClient({
  prefillDomain,
}: {
  prefillDomain?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleClose = () => {
    router.push("/dashboard", { scroll: false });
  };

  const handleSuccess = () => {
    router.push("/dashboard", { scroll: false });
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
        // will be populated by useDomainVerification fetching instructions
        domainName: domain ?? "",
        // Token is not needed here as it will be fetched from the server
        verificationToken: "",
        verificationMethod: method,
      };
    }

    return null;
  }, [searchParams]);

  return (
    <Card className="w-full">
      <AddDomainContent
        className="px-6"
        onClose={handleClose}
        onSuccess={handleSuccess}
        prefillDomain={prefillDomain}
        resumeDomain={resumeDomain}
      />
    </Card>
  );
}
