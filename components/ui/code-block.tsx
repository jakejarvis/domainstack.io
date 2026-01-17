"use client";

import { useRef } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CodeBlockProps {
  copyable?: boolean;
  children: string;
}

export function CodeBlock({ copyable = true, children }: CodeBlockProps) {
  const contentRef = useRef<HTMLPreElement>(null);

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
    <div className="group relative my-4 max-w-full rounded-lg border border-border/50 bg-background">
      {copyable && (
        <CopyButton
          value={children}
          className="!bg-background hover:!bg-background absolute top-2 right-0 z-10 h-8 w-12 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
        />
      )}
      <ScrollArea className="max-h-64 w-full min-w-0 flex-1" showFade={false}>
        <button
          type="button"
          onClick={handleSelect}
          aria-label="Select text"
          className="h-full w-full min-w-0 cursor-text bg-transparent px-3.5 py-4 pr-13 text-left font-mono text-sm outline-none"
        >
          <pre ref={contentRef} className="inline-block">
            {children}
          </pre>
        </button>
      </ScrollArea>
    </div>
  );
}
