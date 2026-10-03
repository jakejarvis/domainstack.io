"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { RegistrationRawDataSkeleton } from "@/components/domain/registration/registration-raw-data-skeleton";
import { RawDataDialog } from "@/components/raw-data-dialog";
import { useTRPC } from "@/lib/trpc/client";

interface RegistrationRawDataDialogProps {
  domain: string;
  format: string;
  serverName: string;
  serverUrl: string | undefined;
}

/** Raw-data dialog that fetches the stored RDAP/WHOIS response the first time it opens. */
export function RegistrationRawDataDialog({
  domain,
  format,
  serverName,
  serverUrl,
}: RegistrationRawDataDialogProps) {
  const trpc = useTRPC();
  const [requested, setRequested] = useState(false);
  const query = useQuery(
    trpc.domain.getRawRegistration.queryOptions(
      { domain },
      { enabled: requested, staleTime: Number.POSITIVE_INFINITY },
    ),
  );

  return (
    <RawDataDialog
      domain={domain}
      format={format}
      data={query.data?.rawResponse}
      loadState={
        query.isPending && requested
          ? "loading"
          : query.isError || query.data === null
            ? "error"
            : undefined
      }
      loadingFallback={<RegistrationRawDataSkeleton format={format} />}
      onOpenChange={(open) => {
        if (open) setRequested(true);
      }}
      serverName={serverName}
      serverUrl={serverUrl}
    />
  );
}
