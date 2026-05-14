import { useQueryClient } from "@tanstack/react-query";
import { Share } from "react-native";

import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { analytics } from "@/lib/analytics";
import { useTRPC } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { DomainResponse } from "@domainstack/types";
import { serializeDomainExport } from "@domainstack/utils";

export function ExportButton({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  async function handleExport() {
    analytics.track("export_json_clicked", { domain });
    try {
      const input = { domain };
      const data: Partial<DomainResponse> = {
        registration: unwrap(queryClient.getQueryData(trpc.domain.getRegistration.queryKey(input))),
        hosting: unwrap(queryClient.getQueryData(trpc.domain.getHosting.queryKey(input))),
        dns: unwrap(queryClient.getQueryData(trpc.domain.getDnsRecords.queryKey(input))),
        certificates: unwrap(queryClient.getQueryData(trpc.domain.getCertificates.queryKey(input))),
        headers: unwrap(queryClient.getQueryData(trpc.domain.getHeaders.queryKey(input))),
        seo: unwrap(queryClient.getQueryData(trpc.domain.getSeo.queryKey(input))),
      };

      const payload = serializeDomainExport(domain, data);
      await Share.share({
        message: JSON.stringify(payload, null, 2),
        title: `${domain} report`,
      });
    } catch (error) {
      analytics.trackException(error, { domain });
      const message = error instanceof Error ? error.message : "Export failed";
      toast.error({ title: "Export failed", message });
    }
  }

  return (
    <Button onPress={() => void handleExport()} variant="secondary">
      <Text>Export</Text>
    </Button>
  );
}

function unwrap<T>(response: { data?: T | null } | undefined): T | undefined {
  return response?.data ?? undefined;
}
