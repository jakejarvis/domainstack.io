import { RemoteIcon } from "@/components/icons/remote-icon";
import { useTRPC } from "@/lib/trpc/client";

export function Favicon({
  domain,
  initialUrl,
  size = 16,
  className,
  style,
}: {
  domain: string;
  /** Cached favicon URL when the caller knows it (`null` = none); skips the per-icon query. */
  initialUrl?: string | null;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const trpc = useTRPC();
  const { queryKey, queryFn } = trpc.domain.getFavicon.queryOptions(
    { domain },
    {
      // Keep in cache indefinitely during session
      staleTime: Number.POSITIVE_INFINITY,
    },
  );

  return (
    <RemoteIcon
      queryOptions={{ queryKey, queryFn }}
      initialUrl={initialUrl}
      fallbackIdentifier={domain}
      size={size}
      className={className}
      style={style}
      alt={`${domain} icon`}
      dataAttribute="data-favicon"
    />
  );
}
