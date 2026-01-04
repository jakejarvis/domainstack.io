"use client";

import clipboardCopy from "clipboard-copy";
import { Check, CircleX, Clipboard, ClipboardCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type CopyableFieldProps = {
  label: string;
  value: string;
  showLabel?: boolean;
  /** Optional custom content to render instead of the plain input (e.g., syntax-highlighted code) */
  children?: React.ReactNode;
  className?: string;
};

export function CopyableField({
  label,
  value,
  showLabel = true,
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
    } catch {
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
    <Field className={cn("min-w-0", className)}>
      <FieldLabel
        className={cn(
          showLabel
            ? "text-muted-foreground text-xs uppercase tracking-wide"
            : "sr-only",
        )}
      >
        {label}
      </FieldLabel>
      <InputGroup className="!bg-popover h-10 max-w-full">
        <ScrollArea
          orientation="horizontal"
          gradient
          gradientContext="popover"
          showScrollbar={false}
          className="w-0 min-w-0 flex-1 overflow-hidden rounded-md"
        >
          <button
            type="button"
            data-slot="input-group-control"
            onClick={handleSelect}
            className="h-[38px] w-max min-w-full cursor-text bg-transparent px-3 text-left font-mono text-[13px] outline-none selection:bg-primary selection:text-primary-foreground"
          >
            <span ref={contentRef} className="inline-block whitespace-nowrap">
              {children ?? value}
            </span>
          </button>
        </ScrollArea>
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            variant="ghost"
            size="icon-sm"
            aria-label={copied ? "Copied URL" : "Copy URL"}
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <Check className="size-3.5 text-success-foreground" />
            ) : (
              <Clipboard className="mb-[1px]" />
            )}
            <span className="sr-only">
              {copied ? "Copied URL" : "Copy URL"}
            </span>
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  );
}
