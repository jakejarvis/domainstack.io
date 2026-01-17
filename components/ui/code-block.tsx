"use client";

import { CopyButton } from "@/components/ui/copy-button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CodeBlockProps {
  copyable?: boolean;
  children: string;
}

export function CodeBlock({ copyable = true, children }: CodeBlockProps) {
  return (
    <div className="group relative my-4 rounded-lg border border-border/50 bg-background/50">
      {copyable && (
        <CopyButton
          value={children}
          className="!bg-background hover:!bg-background absolute top-[9px] right-0 z-10 h-8 w-12 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
        />
      )}
      <ScrollArea className="max-h-64" showFade={false}>
        <pre className="p-4 pr-12 font-mono text-sm">{children}</pre>
      </ScrollArea>
    </div>
  );
}
