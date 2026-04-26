"use client";

import { type CSSProperties, type ReactNode, useCallback, useRef } from "react";

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

  const CodeBlockComponent = useCallback(
    (props: { className?: string }) => (
      <ScrollArea className="w-full rounded-sm border bg-background" scrollFade={false}>
        <pre
          className={cn(
            "not-prose p-3.5 text-[13px] leading-normal outline-none",
            "[&>code]:grid",
            className,
            props.className,
          )}
          ref={ref}
          style={style}
          tabIndex={tabIndex}
        >
          {children}
        </pre>
      </ScrollArea>
    ),
    [children, style, tabIndex, className],
  );

  if (!title) {
    return (
      <div data-slot="code-block" className="group/code-block relative">
        <CodeBlockComponent />
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
        <CodeBlockComponent className="line-numbers rounded-none border-none" />
      </CardContent>
    </Card>
  );
};
