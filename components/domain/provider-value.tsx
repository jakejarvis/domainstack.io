"use client";

import { ProviderIcon } from "@/components/icons/provider-icon";

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
        <ProviderIcon
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
