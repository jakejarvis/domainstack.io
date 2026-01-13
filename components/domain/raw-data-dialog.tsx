"use client";

import {
  ArrowSquareOutIcon,
  ArrowsInSimpleIcon,
  BinaryIcon,
  SealCheckIcon,
} from "@phosphor-icons/react/ssr";
import { useMemo, useState } from "react";
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

interface RawDataDialogProps {
  title: string;
  /** Pre-formatted string: pretty JSON for RDAP, plain text for WHOIS */
  data: string;
  serverUrl: string | undefined;
  serverName: string;
}

export function RawDataDialog({
  title,
  data,
  serverUrl,
  serverName,
}: RawDataDialogProps) {
  const [open, setOpen] = useState(false);
  const [wrapLines, setWrapLines] = useState(true);
  const lines = useMemo(() => data?.trim().split("\n") ?? [], [data]);

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
                  aria-label={`View raw ${title} data`}
                  onClick={() => setOpen(true)}
                >
                  <BinaryIcon className="size-4 text-foreground/95" />
                  <span className="sr-only">View raw {title} data</span>
                </Button>
              }
            />
            <TooltipContent>
              <p>View raw {title} data</p>
            </TooltipContent>
          </Tooltip>
        }
      />
      <DialogContent className="!bg-card gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="place-items-start border-border/60 border-b p-4">
          <DialogTitle className="text-base">Raw {title} Data</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-[13px] text-foreground/90">
            <SealCheckIcon className="size-3.5 text-accent-green" />
            <span className="flex items-center gap-1">
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
            <pre className="font-mono text-foreground/90 text-xs leading-snug">
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
                    className="col-span-2 grid grid-cols-subgrid rounded px-1 py-[3px] hover:bg-muted/50 focus:bg-muted/50 focus:outline-none active:bg-muted/50"
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
                      {line || "\u00A0"}
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
              value={data}
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
