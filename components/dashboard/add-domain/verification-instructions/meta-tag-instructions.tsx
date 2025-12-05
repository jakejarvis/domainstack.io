"use client";

import { Info } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
      <Alert>
        <Info className="size-4" />
        <AlertTitle>{instructions.title}</AlertTitle>
        <AlertDescription>{instructions.description}</AlertDescription>
      </Alert>

      <div className="space-y-3 rounded-lg bg-muted p-4">
        {/* Meta tag field */}
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">
            Meta Tag
          </Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-background px-3 py-2 font-mono text-sm">
              {instructions.metaTag}
            </code>
            <CopyButton value={instructions.metaTag} label="meta tag" />
          </div>
        </div>
      </div>
    </>
  );
}
