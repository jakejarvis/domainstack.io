import { useQueryClient } from "@tanstack/react-query";
import { Alert, Share } from "react-native";

import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { analytics } from "@/lib/analytics";
import { useTRPC } from "@/lib/api";

export function ExportButton({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  async function handleExport() {
    analytics.track("export_json_clicked", { domain });
    try {
      const input = { domain };
      const registration = queryClient.getQueryData(trpc.domain.getRegistration.queryKey(input));
      const hosting = queryClient.getQueryData(trpc.domain.getHosting.queryKey(input));
      const dns = queryClient.getQueryData(trpc.domain.getDnsRecords.queryKey(input));
      const certificates = queryClient.getQueryData(trpc.domain.getCertificates.queryKey(input));
      const headers = queryClient.getQueryData(trpc.domain.getHeaders.queryKey(input));
      const seo = queryClient.getQueryData(trpc.domain.getSeo.queryKey(input));

      const payload = {
        domain,
        exportedAt: new Date().toISOString(),
        registration,
        hosting,
        dns,
        certificates,
        headers,
        seo,
      };

      await Share.share({
        message: JSON.stringify(payload, null, 2),
        title: `${domain} report`,
      });
    } catch (error) {
      analytics.trackException(error, { domain });
      const message = error instanceof Error ? error.message : "Export failed";
      Alert.alert("Domainstack", message);
    }
  }

  return (
    <Button onPress={() => void handleExport()} variant="secondary">
      <Text>Export</Text>
    </Button>
  );
}
