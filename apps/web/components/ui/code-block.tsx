"use client";

import { useRef } from "react";
import { CopyButton } from "@/components/ui/copy-button";

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
    <div className="group relative w-full overflow-hidden rounded-lg border border-border/50 bg-background">
      {copyable && (
        <CopyButton
          value={children}
          className="!bg-background hover:!bg-background absolute top-3.5 right-0 z-10 h-6 w-12 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
        />
      )}
      <div className="max-h-64 overflow-auto overscroll-contain">
        <button
          type="button"
          onClick={handleSelect}
          aria-label="Select text"
          className="block w-full cursor-text bg-transparent text-left outline-none"
        >
          <pre
            ref={contentRef}
            className="my-4 whitespace-pre pr-[50px] pl-4 font-mono text-[13px] leading-5"
          >
            {children}
          </pre>
        </button>
      </div>
    </div>
  );
}
