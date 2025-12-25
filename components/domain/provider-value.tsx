"use client";

import { ProviderLogo } from "@/components/domain/provider-logo";

export function ProviderValue({
  id,
  name,
  domain,
}: {
  id: string | null | undefined;
  name: string;
  domain: string | null;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      {id ? (
        <ProviderLogo
          providerId={id}
          providerName={name}
          providerDomain={domain}
          size={16}
          className="rounded"
        />
      ) : null}
      <span>{name}</span>
    </div>
  );
}
