import { useMemo } from "react";
import { useTRPC } from "@/lib/trpc/client";

/**
 * Hook to generate memoized query keys for all domain sections.
 * Prevents repeated queryOptions calls and provides consistent keys.
 */
export function useDomainQueryKeys(domain: string) {
  const trpc = useTRPC();

  return useMemo(
    () => ({
      getRegistration: trpc.domain.getRegistration.queryOptions({ domain })
        .queryKey,
      getDnsRecords: trpc.domain.getDnsRecords.queryOptions({ domain })
        .queryKey,
      getHosting: trpc.domain.getHosting.queryOptions({ domain }).queryKey,
      getCertificates: trpc.domain.getCertificates.queryOptions({ domain })
        .queryKey,
      getHeaders: trpc.domain.getHeaders.queryOptions({ domain }).queryKey,
      getSeo: trpc.domain.getSeo.queryOptions({ domain }).queryKey,
      getFavicon: trpc.domain.getFavicon.queryOptions({ domain }).queryKey,
    }),
    [trpc, domain],
  );
}
