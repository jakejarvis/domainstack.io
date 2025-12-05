"use client";

import { Info } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import type { DnsInstructions } from "@/lib/schemas";

type DnsVerificationInstructionsProps = {
  instructions: DnsInstructions;
};

export function DnsVerificationInstructions({
  instructions,
}: DnsVerificationInstructionsProps) {
  return (
    <>
      <Alert>
        <Info className="size-4" />
        <AlertTitle>{instructions.title}</AlertTitle>
        <AlertDescription>{instructions.description}</AlertDescription>
      </Alert>

      <div className="space-y-3 rounded-lg bg-muted p-4">
        {/* Hostname field */}
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">
            Host / Name
          </Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-background px-3 py-2 font-mono text-sm">
              {instructions.hostname}
            </code>
            <CopyButton value={instructions.hostname} label="hostname" />
          </div>
        </div>

        {/* Record Type field */}
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">
            Type
          </Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-background px-3 py-2 font-mono text-sm">
              {instructions.recordType}
            </code>
            <CopyButton value={instructions.recordType} label="record type" />
          </div>
        </div>

        {/* Value field */}
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">
            Value / Content
          </Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-background px-3 py-2 font-mono text-sm">
              {instructions.value}
            </code>
            <CopyButton value={instructions.value} label="value" />
          </div>
        </div>

        {/* TTL field */}
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">
            TTL (recommended)
          </Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-background px-3 py-2 font-mono text-sm">
              {instructions.suggestedTTL}{" "}
              <span className="text-muted-foreground">
                ({instructions.suggestedTTLLabel})
              </span>
            </code>
            <CopyButton value={String(instructions.suggestedTTL)} label="TTL" />
          </div>
        </div>
      </div>
    </>
  );
}
