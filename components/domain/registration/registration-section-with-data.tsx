"use client";

import { Suspense } from "react";
import { RegistrationSection } from "@/components/domain/registration/registration-section";
import { RegistrationSectionSkeleton } from "@/components/domain/registration/registration-section-skeleton";
import { useRegistrationQuery } from "@/hooks/use-domain-queries";

function RegistrationSectionContent({ domain }: { domain: string }) {
  const { data } = useRegistrationQuery(domain);
  return <RegistrationSection data={data} />;
}

export function RegistrationSectionWithData({ domain }: { domain: string }) {
  return (
    <Suspense fallback={<RegistrationSectionSkeleton />}>
      <RegistrationSectionContent domain={domain} />
    </Suspense>
  );
}
