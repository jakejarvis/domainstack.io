"use client";

import { type CSSProperties, type ReactNode, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

type CodeBlockProps = {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
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
      <pre
        className={cn(
          "not-prose flex-1 overflow-x-auto rounded-sm border border-border/60 bg-background p-3 text-[13px] leading-normal outline-none",
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
    ),
    [children, style, tabIndex, className],
  );

  if (!title) {
    return (
      <div data-slot="code-block" className="group/code-block relative">
        <CodeBlockComponent />
        <CopyButton
          className="!bg-background hover:!bg-background absolute top-[5px] right-[5px] text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/code-block:opacity-100"
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
      <CardHeader className="flex items-center gap-2 border-b bg-sidebar py-1.5! pr-1.5 pl-4 text-muted-foreground">
        <div
          className="size-3.5 shrink-0"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: "Required for icon prop."
          dangerouslySetInnerHTML={{ __html: icon as unknown as TrustedHTML }}
        />
        <CardTitle className="flex-1 font-mono font-normal text-sm tracking-tight">
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
