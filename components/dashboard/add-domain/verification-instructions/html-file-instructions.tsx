"use client";

import { Download, Info } from "lucide-react";
import { toast } from "sonner";
import { CopyableField } from "@/components/dashboard/add-domain/verification-instructions/copyable-field";
import { Button } from "@/components/ui/button";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@/components/ui/responsive-tooltip";
import { Separator } from "@/components/ui/separator";
import type { HtmlFileInstructions } from "@/lib/schemas";

function downloadVerificationFile(
  filename: string,
  content: string,
): { success: boolean } {
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
  } catch {
    return { success: false };
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
        description: "Upload the file to your website at the path shown.",
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

      <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4 dark:border-white/15 dark:bg-white/2">
        <CopyableField label="Upload Path" value={instructions.fullPath}>
          <span className="inline-flex items-center gap-0.5">
            <span className="select-none text-muted-foreground/85">
              https://{instructions.hostname}
            </span>
            {instructions.fullPath}
          </span>
        </CopyableField>
        <CopyableField label="File Contents" value={instructions.fileContent} />
        <Separator className="my-3 bg-border/60" />
        <ResponsiveTooltip>
          <ResponsiveTooltipTrigger
            render={
              <Button
                variant="outline"
                className="w-full"
                onClick={handleDownload}
              >
                <Download />
                Download File
              </Button>
            }
          />
          <ResponsiveTooltipContent>
            {instructions.filename}
          </ResponsiveTooltipContent>
        </ResponsiveTooltip>
      </div>
    </>
  );
}
