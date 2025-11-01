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
      registration: trpc.domain.registration.queryOptions({ domain }).queryKey,
      dns: trpc.domain.dns.queryOptions({ domain }).queryKey,
      hosting: trpc.domain.hosting.queryOptions({ domain }).queryKey,
      certificates: trpc.domain.certificates.queryOptions({ domain }).queryKey,
      headers: trpc.domain.headers.queryOptions({ domain }).queryKey,
      seo: trpc.domain.seo.queryOptions({ domain }).queryKey,
    }),
    [trpc, domain],
  );
}
