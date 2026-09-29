import { RemoteIcon } from "@/components/icons/remote-icon";
import { useTRPC } from "@/lib/trpc/client";

export function ProviderLogo({
  providerId,
  providerName,
  initialUrl,
  size = 16,
  className,
  style,
}: {
  providerId: string | null | undefined;
  providerName: string | null | undefined;
  /** Cached logo URL when the caller knows it (`null` = none); skips the per-icon query. */
  initialUrl?: string | null;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const trpc = useTRPC();

  if (!providerId) {
    return null;
  }

  const fallbackIdentifier = providerName || "?";
  const { queryKey, queryFn } = trpc.provider.getProviderIcon.queryOptions(
    { providerId },
    {
      // Keep in cache indefinitely during session
      staleTime: Number.POSITIVE_INFINITY,
    },
  );

  return (
    <RemoteIcon
      queryOptions={{ queryKey, queryFn }}
      initialUrl={initialUrl}
      fallbackIdentifier={fallbackIdentifier}
      size={size}
      className={className}
      style={style}
      alt={`${providerName || fallbackIdentifier} logo`}
      dataAttribute="data-provider-logo"
    />
  );
}
