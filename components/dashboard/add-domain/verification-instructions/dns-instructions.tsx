"use client";

import { Info } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
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

      <div className="space-y-3 rounded-lg border border-border/70 bg-secondary/70 p-4">
        {/* Hostname field */}
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">
            Host / Name
          </Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm">
              {instructions.hostname}
            </code>
            <CopyButton value={instructions.hostname} label="hostname" />
          </div>
        </div>

        {/* Record Type field */}
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">
            Type
          </Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm">
              {instructions.recordType}
            </code>
            <CopyButton value={instructions.recordType} label="record type" />
          </div>
        </div>

        {/* Value field */}
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">
            Value / Content
          </Label>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-background px-3 py-2 font-mono text-sm">
              {instructions.value}
            </code>
            <CopyButton value={instructions.value} label="value" />
          </div>
        </div>

        {/* TTL field */}
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">
            TTL (recommended)
          </Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm">
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
