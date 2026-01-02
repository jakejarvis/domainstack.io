import { RemoteIcon } from "@/components/icons/remote-icon";
import { useTRPC } from "@/lib/trpc/client";

export function Favicon({
  domain,
  size = 16,
  className,
  style,
}: {
  domain: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const trpc = useTRPC();

  return (
    <RemoteIcon
      queryOptions={trpc.domain.getFavicon.queryOptions(
        { domain },
        {
          // Keep in cache indefinitely during session
          staleTime: Number.POSITIVE_INFINITY,
        },
      )}
      fallbackIdentifier={domain}
      size={size}
      className={className}
      style={style}
      alt={`${domain} icon`}
      dataAttribute="data-favicon"
    />
  );
}
