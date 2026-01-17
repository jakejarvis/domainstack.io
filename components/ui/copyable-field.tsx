"use client";

import { useRef } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";
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
  const contentRef = useRef<HTMLSpanElement>(null);

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
      <InputGroup className="h-10 min-w-0">
        <ScrollArea
          orientation="horizontal"
          showScrollbar={false}
          className="w-full min-w-0 flex-1"
        >
          <button
            type="button"
            onClick={handleSelect}
            aria-label="Select text"
            className="h-full w-full min-w-0 cursor-text bg-transparent pr-2 pl-3 text-left font-mono text-[13px] outline-none"
          >
            <span ref={contentRef} className="inline-block whitespace-nowrap">
              {children ?? value}
            </span>
          </button>
        </ScrollArea>
        <InputGroupAddon align="inline-end">
          <CopyButton value={value} />
        </InputGroupAddon>
      </InputGroup>
    </Field>
  );
}
