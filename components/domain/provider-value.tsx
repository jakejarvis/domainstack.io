"use client";

import { Favicon } from "@/components/favicon";

export function ProviderValue({
  name,
  domain,
}: {
  name: string;
  domain: string | null;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      {domain ? (
        <Favicon domain={domain} size={16} className="rounded" />
      ) : null}
      <span>{name}</span>
    </div>
  );
}
