"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ExportButtonProps = {
  disabled?: boolean;
  onExport: () => void;
};

export function ExportButton({ disabled, onExport }: ExportButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={onExport}
            disabled={disabled}
          >
            <Download className="sm:text-muted-foreground" />
            <span className="hidden sm:inline-block">Export</span>
          </Button>
        }
      />
      <TooltipContent>
        <p>
          Save this report as a <span className="font-mono">JSON</span> file
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
