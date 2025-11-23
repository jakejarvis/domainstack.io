import { notifyManager, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLogger } from "@/hooks/use-logger";
import { analytics } from "@/lib/analytics/client";
import { exportDomainData } from "@/lib/json-export";

type QueryKeys = {
  registration: readonly unknown[];
  dns: readonly unknown[];
  hosting: readonly unknown[];
  certificates: readonly unknown[];
  headers: readonly unknown[];
  seo: readonly unknown[];
};

/**
 * Hook to handle domain data export and track when all section data is loaded.
 * Subscribes to query cache updates and provides a handler to export all domain data.
 */
export function useDomainExport(domain: string, queryKeys: QueryKeys) {
  const queryClient = useQueryClient();
  const logger = useLogger({ component: "DomainExport" });
  const [allDataLoaded, setAllDataLoaded] = useState(false);
  const queryKeysRef = useRef(queryKeys);

  // Update ref when queryKeys change
  useEffect(() => {
    queryKeysRef.current = queryKeys;
  }, [queryKeys]);

  // Check if all section data is loaded or has cached errors
  useEffect(() => {
    // Check if all queries have data or cached errors and schedule state update
    const checkAndUpdateDataStatus = () => {
      const hasAllData = Object.values(queryKeysRef.current).every((key) => {
        const query = queryClient.getQueryCache().find({ queryKey: key });
        // Consider data loaded if query has data OR has a cached error state
        return (
          query?.state.data !== undefined || query?.state.status === "error"
        );
      });
      // Use TanStack Query's notifyManager to schedule state update in the next batch
      // This prevents updating parent component during child render phase
      notifyManager.schedule(() => {
        setAllDataLoaded(hasAllData);
      });
    };

    // Subscribe to query cache updates to reactively check data availability
    const unsubscribe = queryClient
      .getQueryCache()
      .subscribe(checkAndUpdateDataStatus);

    // Initial check
    checkAndUpdateDataStatus();

    return unsubscribe;
  }, [queryClient]); // Only resubscribe if queryClient changes

  // Export handler that reads all data from React Query cache
  const handleExport = useCallback(() => {
    analytics.track("export_json_clicked", { domain });

    try {
      // Read data from cache using provided query keys
      const registrationData = queryClient.getQueryData(queryKeys.registration);
      const dnsData = queryClient.getQueryData(queryKeys.dns);
      const hostingData = queryClient.getQueryData(queryKeys.hosting);
      const certificatesData = queryClient.getQueryData(queryKeys.certificates);
      const headersData = queryClient.getQueryData(queryKeys.headers);
      const seoData = queryClient.getQueryData(queryKeys.seo);

      // Aggregate into export format
      const exportData = {
        registration: registrationData ?? null,
        dns: dnsData ?? null,
        hosting: hostingData ?? null,
        certificates: certificatesData ?? null,
        headers: headersData ?? null,
        seo: seoData ?? null,
      };

      // Export with partial data (graceful degradation)
      exportDomainData(domain, exportData);
    } catch (err) {
      logger.error("failed to export domain data", err, { domain });

      analytics.trackException(
        err instanceof Error ? err : new Error(String(err)),
        {
          domain,
        },
      );

      // Show error toast
      toast.error(`Failed to export ${domain}`, {
        description:
          err instanceof Error
            ? err.message
            : "An error occurred while exporting",
        position: "bottom-center",
      });
    }
  }, [domain, queryClient, queryKeys, logger.error]);

  return { handleExport, allDataLoaded };
}
