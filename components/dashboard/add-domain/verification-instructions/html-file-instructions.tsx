"use client";

import { Download, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger/client";
import type { HtmlFileInstructions } from "@/lib/schemas";
import { CopyableField } from "./copyable-field";

function downloadVerificationFile(
  filename: string,
  content: string,
): { success: true } | { success: false; error: unknown } {
  try {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();

    // Delay cleanup to ensure the download starts before revoking the URL
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1000);

    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

type HtmlFileVerificationInstructionsProps = {
  instructions: HtmlFileInstructions;
};

export function HtmlFileVerificationInstructions({
  instructions,
}: HtmlFileVerificationInstructionsProps) {
  const handleDownload = () => {
    const result = downloadVerificationFile(
      instructions.filename,
      instructions.fileContent,
    );
    if (result.success) {
      toast.success("File downloaded!", {
        description: `Upload ${instructions.filename} to your website.`,
      });
    } else {
      logger.error("Failed to download verification file", result.error, {
        filename: instructions.filename,
      });
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

      <div className="space-y-3 rounded-lg border border-border bg-muted/50 p-4 dark:border-white/15 dark:bg-white/5">
        <CopyableField label="Upload Path" value={instructions.fullPath} />
        <CopyableField label="File Contents" value={instructions.fileContent} />

        <Button
          variant="outline"
          className="w-full cursor-pointer"
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
