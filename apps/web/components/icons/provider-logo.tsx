import { RemoteIcon } from "@/components/icons/remote-icon";
import { useTRPC } from "@/lib/trpc/client";

export function ProviderLogo({
  providerId,
  providerName,
  size = 16,
  className,
  style,
}: {
  providerId: string | null | undefined;
  providerName: string | null | undefined;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const trpc = useTRPC();

  if (!providerId) {
    return null;
  }

  const fallbackIdentifier = providerName || "?";

  return (
    <RemoteIcon
      queryOptions={{
        ...trpc.provider.getProviderIcon.queryOptions(
          { providerId },
          {
            // Keep in cache indefinitely during session
            staleTime: Number.POSITIVE_INFINITY,
          },
        ),
      }}
      fallbackIdentifier={fallbackIdentifier}
      size={size}
      className={className}
      style={style}
      alt={`${providerName || fallbackIdentifier} logo`}
      dataAttribute="data-provider-logo"
    />
  );
}
