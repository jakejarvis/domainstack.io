"use client";

import clipboardCopy from "clipboard-copy";
import { Check, CircleX, ClipboardCheck, Copy } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { logger } from "@/lib/logger/client";
import { cn } from "@/lib/utils";

type CopyableFieldProps = {
  label: string;
  value: string;
  /** Optional custom content to render instead of the plain input (e.g., syntax-highlighted code) */
  children?: ReactNode;
  className?: string;
};

export function CopyableField({
  label,
  value,
  children,
  className,
}: CopyableFieldProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);
  const contentRef = useRef<HTMLSpanElement>(null);

  // Clear the reset timer on unmount to prevent setState on unmounted component
  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await clipboardCopy(value);

      toast.success("Copied!", {
        icon: <ClipboardCheck className="h-4 w-4" />,
        position: "bottom-center",
      });

      setCopied(true);

      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        resetTimerRef.current = null;
      }, 1200);
    } catch (error) {
      logger.error("Failed to copy to clipboard", error, { value });
      toast.error("Failed to copy", {
        icon: <CircleX className="h-4 w-4" />,
        position: "bottom-center",
      });
    }
  };

  const handleSelect = () => {
    if (!contentRef.current) return;
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(contentRef.current);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label className="text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </Label>
      <InputGroup className="max-w-full border-border bg-background">
        <div className="min-w-0 flex-1 overflow-hidden">
          <button
            type="button"
            data-slot="input-group-control"
            onClick={handleSelect}
            className="flex h-10 w-full cursor-text items-center overflow-x-auto bg-transparent px-3 text-left font-mono text-sm outline-none selection:bg-primary selection:text-primary-foreground"
          >
            <span ref={contentRef} className="whitespace-nowrap">
              {children ?? value}
            </span>
          </button>
        </div>
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            variant="ghost"
            size="icon-xs"
            aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
