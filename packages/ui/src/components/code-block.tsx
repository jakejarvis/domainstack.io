"use client";

import { type CSSProperties, type ReactNode, type RefObject, useCallback, useRef } from "react";

import { cn } from "../utils";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { CopyButton } from "./copy-button";
import { ScrollArea } from "./scroll-area";

type CodeBlockProps = {
  children: ReactNode;
  className?: string;
  /** Raw SVG/HTML string for the icon */
  icon?: string;
  style?: CSSProperties;
  tabIndex?: number;
  title?: string;
};

function CodeBlockPre({
  children,
  className,
  preRef,
  style,
  tabIndex,
}: {
  children: ReactNode;
  className?: string;
  preRef: RefObject<HTMLPreElement | null>;
  style?: CSSProperties;
  tabIndex?: number;
}) {
  return (
    <ScrollArea className="w-full rounded-sm border bg-background" scrollFade={false}>
      <pre
        className={cn(
          "not-prose p-3.5 text-[13px] leading-normal outline-none",
          "[&>code]:grid",
          className,
        )}
        ref={preRef}
        style={style}
        tabIndex={tabIndex}
      >
        {children}
      </pre>
    </ScrollArea>
  );
}

export const CodeBlock = ({
  children,
  className,
  icon,
  style,
  tabIndex,
  title,
}: CodeBlockProps) => {
  const ref = useRef<HTMLPreElement>(null);

  // Read the text content when copy is triggered, not at render time
  const getValue = useCallback(() => ref.current?.innerText ?? "", []);

  if (!title) {
    return (
      <div data-slot="code-block" className="group/code-block relative">
        <CodeBlockPre className={className} preRef={ref} style={style} tabIndex={tabIndex}>
          {children}
        </CodeBlockPre>
        <CopyButton
          className="absolute top-[5px] right-[5px] !bg-background text-muted-foreground opacity-0 transition-opacity group-hover/code-block:opacity-100 hover:!bg-background hover:text-foreground"
          value={getValue}
        />
      </div>
    );
  }

  return (
    <Card
      data-slot="code-block"
      className="not-prose gap-0 overflow-hidden rounded-sm p-0 shadow-none"
    >
      <CardHeader className="bg-sidebar flex items-center gap-2 border-b py-1.5! pr-1.5 pl-4 text-muted-foreground">
        {icon && <div className="size-3.5 shrink-0" dangerouslySetInnerHTML={{ __html: icon }} />}
        <CardTitle className="flex-1 font-mono text-sm font-normal tracking-tight">
          {title}
        </CardTitle>
        <CopyButton value={getValue} />
      </CardHeader>
      <CardContent className="p-0">
        <CodeBlockPre
          className={cn(className, "line-numbers rounded-none border-none")}
          preRef={ref}
          style={style}
          tabIndex={tabIndex}
        >
          {children}
        </CodeBlockPre>
      </CardContent>
    </Card>
  );
};
