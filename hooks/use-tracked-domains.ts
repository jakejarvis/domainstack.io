"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { TrackedDomainWithDetails } from "@/lib/db/repos/tracked-domains";
import { useTRPC } from "@/lib/trpc/client";

export type UseTrackedDomainsOptions = {
  /** Whether to include archived domains in the results (defaults to false) */
  includeArchived?: boolean;
  /** Whether to enable the query (defaults to true) */
  enabled?: boolean;
};

export type UseTrackedDomainsResult = {
  /** Array of tracked domains (undefined while loading) */
  domains: TrackedDomainWithDetails[] | undefined;
  /** True if actively loading */
  isLoading: boolean;
  /** True if error occurred */
  isError: boolean;
  /** Refetch tracked domains data */
  refetch: () => void;
  /** Invalidate tracked domains query cache */
  invalidate: () => void;
};

/**
 * Hook to fetch and manage user's tracked domains.
 * Use this to access tracked domains list and perform cache operations.
 *
 * @param options - Configuration options
 * @param options.includeArchived - Whether to include archived domains (defaults to false)
 * @param options.enabled - Whether to enable the query (defaults to true)
 *
 * @example
 * ```tsx
 * function DomainList() {
 *   const { domains, isLoading } = useTrackedDomains();
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <ul>
 *       {domains?.map((d) => (
 *         <li key={d.id}>{d.domainName}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Include archived domains
 * function AllDomains() {
 *   const { domains, invalidate } = useTrackedDomains({ includeArchived: true });
 *
 *   const handleArchive = async (id: string) => {
 *     await archiveMutation.mutateAsync({ trackedDomainId: id });
 *     invalidate(); // Refresh the list
 *   };
 *
 *   return <DomainGrid domains={domains} onArchive={handleArchive} />;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Conditionally enable query based on auth state
 * function PublicComponent() {
 *   const { data: session } = useSession();
 *   const { domains } = useTrackedDomains({ enabled: !!session?.user });
 *
 *   if (!session?.user) {
 *     return <LoginPrompt />;
 *   }
 *
 *   return <DomainList domains={domains} />;
 * }
 * ```
 */
export function useTrackedDomains(
  options: UseTrackedDomainsOptions = {},
): UseTrackedDomainsResult {
  const { includeArchived = false, enabled = true } = options;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const query = useQuery({
    ...trpc.tracking.listDomains.queryOptions({ includeArchived }),
    enabled,
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.tracking.listDomains.queryKey(),
    });
  }, [queryClient, trpc]);

  return {
    domains: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    invalidate,
  };
}
