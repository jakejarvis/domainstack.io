"use client";

import {
  ArrowSquareOutIcon,
  ArrowsInSimpleIcon,
  BinaryIcon,
  SealCheckIcon,
} from "@phosphor-icons/react/ssr";
import { type ReactNode, useMemo, useState } from "react";
import { Favicon } from "@/components/icons/favicon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Token types for JSON syntax highlighting
type TokenType =
  | "key"
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "punctuation";

interface Token {
  type: TokenType;
  value: string;
}

/**
 * Simple JSON tokenizer that produces tokens for syntax highlighting.
 * Only used for RDAP (JSON) data, not for WHOIS (plain text).
 */
function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    // Whitespace - preserve as punctuation
    if (/\s/.test(line[i])) {
      let ws = "";
      while (i < line.length && /\s/.test(line[i])) {
        ws += line[i++];
      }
      tokens.push({ type: "punctuation", value: ws });
      continue;
    }

    // Punctuation: { } [ ] , :
    if (/[{}[\],:]/u.test(line[i])) {
      tokens.push({ type: "punctuation", value: line[i++] });
      continue;
    }

    // String (could be key or value)
    if (line[i] === '"') {
      let str = '"';
      i++;
      while (i < line.length && line[i] !== '"') {
        if (line[i] === "\\") {
          str += line[i++];
          if (i < line.length) str += line[i++];
        } else {
          str += line[i++];
        }
      }
      if (i < line.length) str += line[i++]; // closing quote

      // Check if followed by colon (making it a key)
      let lookahead = i;
      while (lookahead < line.length && /\s/.test(line[lookahead])) {
        lookahead++;
      }
      const isKey = lookahead < line.length && line[lookahead] === ":";

      tokens.push({ type: isKey ? "key" : "string", value: str });
      continue;
    }

    // Number
    if (/[-\d]/.test(line[i])) {
      let num = "";
      if (line[i] === "-") num += line[i++];
      while (i < line.length && /[\d.eE+-]/.test(line[i])) {
        num += line[i++];
      }
      tokens.push({ type: "number", value: num });
      continue;
    }

    // Keywords: true, false, null
    const remaining = line.slice(i);
    if (remaining.startsWith("true")) {
      tokens.push({ type: "boolean", value: "true" });
      i += 4;
      continue;
    }
    if (remaining.startsWith("false")) {
      tokens.push({ type: "boolean", value: "false" });
      i += 5;
      continue;
    }
    if (remaining.startsWith("null")) {
      tokens.push({ type: "null", value: "null" });
      i += 4;
      continue;
    }

    // Fallback: consume single character
    tokens.push({ type: "punctuation", value: line[i++] });
  }

  return tokens;
}

/**
 * Renders a tokenized line with syntax highlighting using CSS classes.
 * Falls back to plain text if tokenization fails for any reason.
 */
function HighlightedLine({
  line,
  isJson,
}: {
  line: string;
  isJson: boolean;
}): ReactNode {
  // For non-JSON (WHOIS), render plain text
  if (!isJson) {
    return <>{line || "\u00A0"}</>;
  }

  // Empty line
  if (!line.trim()) {
    return <>{"\u00A0"}</>;
  }

  // Attempt tokenization with graceful fallback to plain text
  let tokens: Token[];
  try {
    tokens = tokenizeLine(line);
    // Sanity check: ensure tokens reconstruct the original line
    const reconstructed = tokens.map((t) => t.value).join("");
    if (reconstructed !== line) {
      return <>{line}</>;
    }
  } catch {
    // Tokenization failed - fall back to plain text
    return <>{line}</>;
  }

  return (
    <>
      {tokens.map((token, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: tokens are derived from line content
          key={i}
          className={cn(
            // Carefully chosen Tailwind colors for good contrast in both light/dark modes
            // Light: ~99.5% lightness bg, Dark: ~16.5% lightness bg (card)
            token.type === "key" && "text-blue-700 dark:text-blue-400",
            token.type === "string" && "text-emerald-700 dark:text-emerald-400",
            token.type === "number" && "text-amber-700 dark:text-amber-400",
            token.type === "boolean" && "text-violet-700 dark:text-violet-400",
            token.type === "null" &&
              "text-stone-500 italic dark:text-stone-400",
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

export function RawDataDialog({
  domain,
  format,
  data,
  serverName,
  serverUrl,
}: RawDataDialogProps) {
  const [open, setOpen] = useState(false);
  const [wrapLines, setWrapLines] = useState(true);

  const isJson = typeof data !== "string";

  // Prettify JSON objects on the client side, keep strings as-is (WHOIS)
  const formattedData = useMemo(() => {
    if (typeof data === "string") {
      return data;
    }
    return JSON.stringify(data, null, 2);
  }, [data]);

  const lines = useMemo(
    () => formattedData?.trim().split("\n") ?? [],
    [formattedData],
  );

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
                  <BinaryIcon className="size-4 text-foreground/95" />
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
      <DialogContent className="!bg-card gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="place-items-start space-y-1 border-border/60 border-b p-4">
          <DialogTitle className="flex items-center gap-1 text-base">
            <Favicon domain={domain} className="mr-1 size-5" />
            <span>
              <span className="truncate">{domain}</span>{" "}
              <span className="font-normal text-muted-foreground/90 text-sm">
                ({format})
              </span>
            </span>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-[13px] text-foreground/90">
            <SealCheckIcon className="size-3.5 text-accent-green" />
            <span className="flex items-center gap-1 truncate">
              Verified by{" "}
              <span className="font-medium">
                {serverUrl ? (
                  <a
                    href={serverUrl}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center gap-1 underline underline-offset-2 hover:text-muted-foreground"
                  >
                    {serverName}
                    <ArrowSquareOutIcon className="size-3 text-muted-foreground" />
                  </a>
                ) : (
                  serverName
                )}
              </span>
            </span>
          </DialogDescription>
        </DialogHeader>
        <ScrollArea
          className="relative flex min-h-0 flex-1 overflow-hidden"
          showFade={false}
        >
          <div className="p-3">
            <pre className="font-mono text-foreground/90 text-xs leading-5">
              <code
                className={cn(
                  "grid",
                  wrapLines ? "grid-cols-[auto_1fr]" : "grid-cols-[auto_auto]",
                )}
              >
                {lines.map((line, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: static list, no reordering
                    key={i}
                    className="col-span-2 grid grid-cols-subgrid rounded px-1 py-0.5 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none active:bg-muted/50"
                  >
                    <span className="select-none justify-self-end px-1 text-muted-foreground/70">
                      {i + 1}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 pr-1 pl-3",
                        wrapLines
                          ? "whitespace-pre-wrap break-all"
                          : "whitespace-pre",
                      )}
                    >
                      <HighlightedLine line={line} isJson={isJson} />
                    </span>
                  </div>
                ))}
              </code>
            </pre>
          </div>
        </ScrollArea>
        <div className="flex w-full items-center justify-between gap-2 border-border/60 border-t p-3">
          <Button
            variant="outline"
            size="sm"
            className="!px-3 gap-2 text-[13px]"
            onClick={() => setWrapLines(!wrapLines)}
          >
            <Checkbox checked={wrapLines} className="size-3.5" />
            Wrap lines
          </Button>
          <div className="space-x-2">
            <CopyButton
              variant="outline"
              size="sm"
              className="!px-3 gap-2 text-[13px]"
              value={formattedData}
              showLabel={true}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="!px-3 gap-2 text-[13px]"
            >
              <ArrowsInSimpleIcon />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function _extractSourceDomain(
  input: string | undefined | null,
): string | undefined {
  if (!input) return;
  const value = String(input).trim();
  if (!value) return;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return url.hostname || undefined;
  } catch {
    return;
  }
}
