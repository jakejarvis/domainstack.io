"use client";

import { Info } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { Label } from "@/components/ui/label";
import type { MetaTagInstructions } from "@/lib/schemas";

type MetaTagVerificationInstructionsProps = {
  instructions: MetaTagInstructions;
};

export function MetaTagVerificationInstructions({
  instructions,
}: MetaTagVerificationInstructionsProps) {
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
        {/* Meta tag field */}
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">
            Meta Tag
          </Label>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-background px-3 py-2 font-mono text-sm">
              {instructions.metaTag}
            </code>
            <CopyButton value={instructions.metaTag} label="meta tag" />
          </div>
        </div>
      </div>
    </>
  );
}
