"use client";

import { Download, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { HtmlFileInstructions } from "@/lib/schemas";
import { CopyableField } from "./copyable-field";

function downloadVerificationFile(filename: string, content: string): boolean {
  try {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

type HtmlFileVerificationInstructionsProps = {
  instructions: HtmlFileInstructions;
};

export function HtmlFileVerificationInstructions({
  instructions,
}: HtmlFileVerificationInstructionsProps) {
  const handleDownload = () => {
    const success = downloadVerificationFile(
      instructions.filename,
      instructions.fileContent,
    );
    if (success) {
      toast.success("File downloaded!", {
        description: `Upload ${instructions.filename} to your website.`,
      });
    } else {
      toast.error("Failed to download file");
    }
  };

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

      <div className="space-y-3 overflow-hidden rounded-lg border border-border bg-muted/50 p-4 dark:border-white/15 dark:bg-white/5">
        <CopyableField label="Upload Path" value={instructions.fullPath} />
        <CopyableField label="File Contents" value={instructions.fileContent} />

        <Button
          variant="secondary"
          className="w-full"
          onClick={handleDownload}
          type="button"
        >
          <Download className="size-4" />
          Download {instructions.filename}
        </Button>
      </div>
    </>
  );
}
