"use client";

import { Info } from "lucide-react";
import { CopyableField } from "@/components/dashboard/add-domain/verification-instructions/copyable-field";
import type { DnsInstructions } from "@/lib/schemas";

type DnsVerificationInstructionsProps = {
  instructions: DnsInstructions;
};

export function DnsVerificationInstructions({
  instructions,
}: DnsVerificationInstructionsProps) {
  // Split hostname into prefix (_domainstack-verify) and domain (.example.com)
  const dotIndex = instructions.hostname.indexOf(".");
  const hostnamePrefix =
    dotIndex > 0
      ? instructions.hostname.slice(0, dotIndex)
      : instructions.hostname;
  const hostnameDomain =
    dotIndex > 0 ? instructions.hostname.slice(dotIndex) : "";

  return (
    <>
      <div className="flex gap-3 rounded-lg border border-info-border bg-info p-3">
        <Info className="mt-0.5 size-4 shrink-0 text-info-foreground" />
        <div className="space-y-0.5">
          <p className="font-medium text-info-foreground text-sm">
            {instructions.title}
          </p>
          <p className="text-info-foreground/80 text-sm">
            {instructions.description}
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4 dark:border-white/15 dark:bg-white/2">
        <CopyableField label="Host / Name" value={hostnamePrefix}>
          <span>
            {hostnamePrefix}
            <span className="select-none text-muted-foreground">
              {hostnameDomain}
            </span>
          </span>
        </CopyableField>
        <CopyableField label="Type" value={instructions.recordType} />
        <CopyableField label="Value / Content" value={instructions.value} />
        <CopyableField
          label="TTL (recommended)"
          value={String(instructions.suggestedTTL)}
        >
          <span>
            {instructions.suggestedTTL}
            <span className="select-none text-muted-foreground">
              {" "}
              ({instructions.suggestedTTLLabel})
            </span>
          </span>
        </CopyableField>
      </div>
    </>
  );
}
