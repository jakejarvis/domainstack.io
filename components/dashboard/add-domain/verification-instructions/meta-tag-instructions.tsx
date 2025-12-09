"use client";

import { Info } from "lucide-react";
import { CopyableField } from "@/components/dashboard/add-domain/verification-instructions/copyable-field";
import type { MetaTagInstructions } from "@/lib/schemas";

type MetaTagVerificationInstructionsProps = {
  instructions: MetaTagInstructions;
};

export function MetaTagVerificationInstructions({
  instructions,
}: MetaTagVerificationInstructionsProps) {
  // Extract token from the meta tag (format: <meta name="domainstack-verify" content="TOKEN">)
  const tokenMatch = instructions.metaTag.match(/content="([^"]+)"/);
  const token = tokenMatch?.[1] ?? "";

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

      <div className="space-y-3 rounded-lg border border-border bg-muted/50 p-4 dark:border-white/15 dark:bg-white/3">
        <CopyableField label="Meta Tag" value={instructions.metaTag}>
          {/* Syntax highlighted meta tag */}
          <span>
            <span className="text-zinc-500 dark:text-zinc-400">&lt;</span>
            <span className="text-rose-600 dark:text-rose-400">meta</span>
            <span className="text-sky-600 dark:text-sky-400"> name</span>
            <span className="text-zinc-500 dark:text-zinc-400">=</span>
            <span className="text-emerald-600 dark:text-emerald-400">
              "domainstack-verify"
            </span>
            <span className="text-sky-600 dark:text-sky-400"> content</span>
            <span className="text-zinc-500 dark:text-zinc-400">=</span>
            <span className="text-emerald-600 dark:text-emerald-400">
              "{token}"
            </span>
            <span className="text-zinc-500 dark:text-zinc-400">&gt;</span>
          </span>
        </CopyableField>
      </div>
    </>
  );
}
