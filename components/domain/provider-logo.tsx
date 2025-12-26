"use client";

import { RemoteIcon } from "@/components/remote-icon";
import { useTRPC } from "@/lib/trpc/client";

export function ProviderLogo({
  providerId,
  providerName,
  providerDomain,
  size = 16,
  className,
  style,
}: {
  providerId: string | null | undefined;
  providerName: string | null | undefined;
  providerDomain?: string | null;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const trpc = useTRPC();
  const fallbackIdentifier = providerDomain || providerName || "?";

  return (
    <RemoteIcon
      queryOptions={trpc.domain.getProviderLogo.queryOptions(
        { providerId: providerId ?? "" },
        {
          // Keep in cache indefinitely during session
          staleTime: Number.POSITIVE_INFINITY,
          // Don't fetch if no providerId
          enabled: !!providerId,
        },
      )}
      fallbackIdentifier={fallbackIdentifier}
      size={size}
      className={className}
      style={style}
      alt={`${providerName || fallbackIdentifier} logo`}
      dataAttribute="data-provider-logo"
    />
  );
}
