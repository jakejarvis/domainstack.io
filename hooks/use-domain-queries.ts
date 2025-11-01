import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

/**
 * Modern Suspense-based data fetching.
 *
 * All queries use useSuspenseQuery - they suspend rendering until data is ready.
 * No isLoading states, no error states in components - Suspense and Error Boundaries handle everything.
 *
 * For conditional queries (secondary sections gated by registration), we use a wrapper
 * component pattern in the UI layer to conditionally render based on registration data.
 */

export function useRegistrationQuery(domain: string) {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.domain.registration.queryOptions({ domain }));
}

export function useDnsQuery(domain: string) {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.domain.dns.queryOptions({ domain }));
}

export function useHostingQuery(domain: string) {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.domain.hosting.queryOptions({ domain }));
}

export function useCertificatesQuery(domain: string) {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.domain.certificates.queryOptions({ domain }));
}

export function useHeadersQuery(domain: string) {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.domain.headers.queryOptions({ domain }));
}

export function useSeoQuery(domain: string) {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.domain.seo.queryOptions({ domain }));
}
