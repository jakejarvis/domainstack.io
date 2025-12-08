"use client";

import { AddDomainContent } from "@/components/dashboard/add-domain/add-domain-content";
import { useRouter } from "@/hooks/use-router";

export function AddDomainPageClient({
  prefillDomain,
}: {
  prefillDomain?: string;
}) {
  const router = useRouter();

  const handleClose = () => {
    router.push("/dashboard");
  };

  const handleSuccess = () => {
    router.push("/dashboard");
  };

  return (
    <AddDomainContent
      showCard
      className="w-full"
      onClose={handleClose}
      onSuccess={handleSuccess}
      prefillDomain={prefillDomain}
    />
  );
}
