import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { captureClient } from "@/lib/analytics/client";
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
  const [allDataLoaded, setAllDataLoaded] = useState(false);

  // Check if all section data is loaded in cache
  useEffect(() => {
    // Subscribe to query cache updates to reactively check data availability
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      const hasAllData = Object.values(queryKeys).every(
        (key) => queryClient.getQueryData(key) !== undefined,
      );
      setAllDataLoaded(hasAllData);
    });

    // Initial check
    const hasAllData = Object.values(queryKeys).every(
      (key) => queryClient.getQueryData(key) !== undefined,
    );
    setAllDataLoaded(hasAllData);

    return unsubscribe;
  }, [queryClient, queryKeys]);

  // Export handler that reads all data from React Query cache
  const handleExport = useCallback(() => {
    captureClient("export_json_clicked", { domain });

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
    } catch (error) {
      console.error("[export] failed to export domain data", error);
      captureClient("export_json_failed", {
        domain,
        error: error instanceof Error ? error.message : String(error),
      });

      // Show error toast
      toast.error(`Failed to export ${domain}`, {
        description:
          error instanceof Error
            ? error.message
            : "An error occurred while exporting",
        position: "bottom-center",
      });
    }
  }, [domain, queryClient, queryKeys]);

  return { handleExport, allDataLoaded };
}
