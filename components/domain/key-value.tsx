"use client";

import { CopyButton } from "@/components/copy-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTruncation } from "@/hooks/use-truncation";
import { cn } from "@/lib/utils";

export function KeyValue({
  label,
  value,
  copyable,
  leading,
  highlight,
  trailing,
  suffix,
  valueTooltip,
}: {
  label?: string;
  value: string;
  copyable?: boolean;
  leading?: React.ReactNode;
  highlight?: boolean;
  trailing?: React.ReactNode;
  suffix?: React.ReactNode;
  valueTooltip?: React.ReactNode;
}) {
  const { valueRef, isTruncated } = useTruncation();

  return (
    <div
      className={cn(
        "flex h-16 min-w-0 items-center justify-between gap-4 rounded-2xl border bg-background/40 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-lg",
        highlight
          ? "border-purple-500/20 bg-purple-500/5 shadow-[inset_0_1px_0_rgba(168,85,247,0.18)] dark:border-purple-500/20"
          : "border-black/10 dark:border-white/10",
      )}
    >
      <div className="flex min-w-0 flex-col space-y-1.5">
        {label && (
          <div
            className={cn(
              "pt-1 text-[10px] uppercase leading-none tracking-[0.08em]",
              highlight
                ? "text-purple-700/80 dark:text-purple-300/85"
                : "text-foreground/75 dark:text-foreground/80",
            )}
          >
            {label}
          </div>
        )}
        <div className="inline-flex min-w-0 items-center gap-1.5 text-[13px] text-foreground/95">
          {leading ? (
            <span className="h-4 w-4 rounded leading-none [&>img]:block [&>img]:h-full [&>img]:w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full">
              {leading}
            </span>
          ) : null}

          <Tooltip>
            <TooltipTrigger
              nativeButton={false}
              render={
                <span ref={valueRef} className="min-w-0 flex-1 truncate">
                  {value}
                </span>
              }
            />
            <TooltipContent
              className={cn(
                isTruncated || valueTooltip != null
                  ? "max-w-[80vw] whitespace-pre-wrap break-words md:max-w-[40rem]"
                  : "hidden",
              )}
            >
              {valueTooltip ?? value}
            </TooltipContent>
          </Tooltip>

          {suffix ? (
            <span className="leading-none [&_img]:block [&_img]:h-4 [&_img]:w-4 [&_span]:leading-none [&_svg]:block [&_svg]:h-4 [&_svg]:w-4">
              {suffix}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {trailing}
        {copyable && <CopyButton value={value} label={label} />}
      </div>
    </div>
  );
}
