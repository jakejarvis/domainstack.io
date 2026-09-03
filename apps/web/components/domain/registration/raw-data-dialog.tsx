"use client";

import {
  IconExternalLink,
  IconRosetteDiscountCheck,
  IconX,
  IconZoomCode,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";

import { tokenizeJson, type JsonToken } from "@/components/domain/registration/json-highlight";
import { Favicon } from "@/components/icons/favicon";
import { Button } from "@domainstack/ui/button";
import { Checkbox } from "@domainstack/ui/checkbox";
import { CopyButton } from "@domainstack/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@domainstack/ui/dialog";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@domainstack/ui/tooltip";
import { cn } from "@domainstack/ui/utils";

function withTokenKeys(tokens: JsonToken[]) {
  const seen = new Map<string, number>();

  return tokens.map((token) => {
    const baseKey = `${token.type}:${token.value}`;
    const duplicateCount = seen.get(baseKey) ?? 0;
    seen.set(baseKey, duplicateCount + 1);

    return { key: `${baseKey}:${duplicateCount}`, token };
  });
}

function HighlightedLine({
  line,
  tokens,
}: {
  line: string;
  tokens: ReturnType<typeof withTokenKeys> | null;
}): React.ReactNode {
  if (!tokens || tokens.length === 0) {
    return <>{line || "\u00A0"}</>;
  }

  return (
    <>
      {tokens.map(({ key, token }) => (
        <span
          key={key}
          className={cn(
            token.type === "key" && "text-blue-700 dark:text-blue-400",
            token.type === "string" && "text-emerald-700 dark:text-emerald-400",
            token.type === "number" && "text-amber-700 dark:text-amber-400",
            token.type === "boolean" && "text-violet-700 dark:text-violet-400",
            token.type === "null" && "text-stone-500 italic dark:text-stone-400",
          )}
        >
          {token.value}
        </span>
      ))}
    </>
  );
}

interface RawDataDialogProps {
  domain: string;
  format: string;
  /** Raw data: JSON object for RDAP, plain text string for WHOIS */
  data: Record<string, unknown> | string;
  serverName: string;
  serverUrl: string | undefined;
}

export function RawDataDialog({ domain, format, data, serverName, serverUrl }: RawDataDialogProps) {
  const [open, setOpen] = useState(false);
  const [wrapLines, setWrapLines] = useState(true);

  const formattedData = useMemo(() => {
    if (typeof data === "string") {
      return data;
    }
    return JSON.stringify(data, null, 2);
  }, [data]);

  const lineItems = useMemo(() => {
    const source = formattedData.trim();

    if (typeof data === "string") {
      return source.split("\n").map((line, index) => ({
        lineNumber: index + 1,
        line,
        tokens: null,
      }));
    }

    return tokenizeJson(source).map((tokens, index) => ({
      lineNumber: index + 1,
      line: tokens.map((token) => token.value).join(""),
      tokens: withTokenKeys(tokens),
    }));
  }, [data, formattedData]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`View raw ${format} data`}
                  onClick={() => setOpen(true)}
                >
                  <IconZoomCode className="size-4 text-foreground/95" />
                  <span className="sr-only">View raw {format} data</span>
                </Button>
              }
            />
            <TooltipContent>
              <p>View raw {format} data</p>
            </TooltipContent>
          </Tooltip>
        }
      />
      <DialogContent className="gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="place-items-start space-y-1 border-b border-border bg-card/60 p-4">
          <DialogTitle className="flex items-center gap-2">
            <Favicon domain={domain} />
            <span className="truncate text-base tracking-[-0.01em] lowercase">{domain}</span>
            <ResponsiveTooltip>
              <ResponsiveTooltipTrigger
                render={
                  <span className="ml-1 flex cursor-default items-center gap-1 text-[13px] font-normal text-foreground/75">
                    <IconRosetteDiscountCheck className="size-3.5 text-accent-green" />
                    <span>{format}</span>
                  </span>
                }
              />
              <ResponsiveTooltipContent>
                <span className="flex items-center gap-1 truncate">
                  Verified by{" "}
                  <span className="font-medium">
                    {serverUrl ? (
                      <a
                        href={serverUrl}
                        target="_blank"
                        rel="noopener"
                        className="flex items-center gap-1 underline underline-offset-2"
                      >
                        {serverName}
                        <IconExternalLink className="size-3 -translate-y-[1px]" />
                      </a>
                    ) : (
                      serverName
                    )}
                  </span>
                </span>
              </ResponsiveTooltipContent>
            </ResponsiveTooltip>
          </DialogTitle>
        </DialogHeader>
        <div
          // Scrollable region needs a tab stop so keyboard users can pan the raw dump.
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className="min-h-0 flex-1 overflow-auto overscroll-contain bg-popover/10 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1"
          aria-label={`Raw ${format} data`}
        >
          <div className="p-3">
            <pre className="font-mono text-xs leading-5 text-foreground/90">
              <code
                className={cn(
                  "grid",
                  wrapLines ? "grid-cols-[auto_1fr]" : "w-max min-w-full grid-cols-[auto_auto]",
                )}
              >
                {lineItems.map((item) => (
                  <div
                    key={item.lineNumber}
                    className="col-span-2 grid grid-cols-subgrid rounded px-1 py-0.5 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none active:bg-muted/50"
                  >
                    <span className="justify-self-end px-1 text-muted-foreground/70 select-none">
                      {item.lineNumber}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 pr-1 pl-3",
                        wrapLines ? "break-all whitespace-pre-wrap" : "whitespace-pre",
                      )}
                    >
                      <HighlightedLine line={item.line} tokens={item.tokens} />
                    </span>
                  </div>
                ))}
              </code>
            </pre>
          </div>
        </div>
        <div className="flex w-full items-center justify-between gap-2 border-t border-border bg-card/60 p-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 !px-3 text-[13px]"
            onClick={() => setWrapLines((prev) => !prev)}
          >
            <Checkbox checked={wrapLines} className="size-3.5" />
            Wrap lines
          </Button>
          <div className="space-x-2">
            <CopyButton
              variant="outline"
              size="sm"
              className="gap-2 !px-3 text-[13px]"
              value={formattedData}
              showLabel={true}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="gap-2 !px-3 text-[13px]"
            >
              <IconX />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
