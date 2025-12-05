"use client";

import { Download, Info } from "lucide-react";
import { toast } from "sonner";
import { CopyButton } from "@/components/copy-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { HtmlFileInstructions } from "@/lib/schemas";

function downloadVerificationFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type HtmlFileVerificationInstructionsProps = {
  instructions: HtmlFileInstructions;
};

export function HtmlFileVerificationInstructions({
  instructions,
}: HtmlFileVerificationInstructionsProps) {
  const handleDownload = () => {
    downloadVerificationFile(instructions.filename, instructions.fileContent);
    toast.success("File downloaded!", {
      description: `Upload ${instructions.filename} to your website.`,
    });
  };

  return (
    <>
      <Alert>
        <Info className="size-4" />
        <AlertTitle>{instructions.title}</AlertTitle>
        <AlertDescription>{instructions.description}</AlertDescription>
      </Alert>

      <div className="space-y-3 rounded-lg bg-muted p-4">
        {/* File path field */}
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">
            Upload Path
          </Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-background px-3 py-2 font-mono text-sm">
              {instructions.fullPath}
            </code>
            <CopyButton value={instructions.fullPath} label="file path" />
          </div>
        </div>

        {/* File contents field */}
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">
            File Contents
          </Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-background px-3 py-2 font-mono text-sm">
              {instructions.fileContent}
            </code>
            <CopyButton
              value={instructions.fileContent}
              label="file contents"
            />
          </div>
        </div>

        {/* Download button */}
        <Button
          variant="outline"
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
