"use client";

import { useEffect, useState } from "react";
import { Screenshot } from "@/components/domain/screenshot";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePointerCapability } from "@/hooks/use-pointer-capability";
import { cn } from "@/lib/utils";

export function ScreenshotTooltip({
  domain,
  children,
}: {
  domain: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const { supportsHover } = usePointerCapability();

  // Reset tap count when tooltip closes
  useEffect(() => {
    if (!open) {
      setTapCount(0);
    }
  }, [open]);

  const handleInteraction = (e: React.MouseEvent<HTMLElement>) => {
    // On touch devices (no hover support), implement two-tap behavior
    if (!supportsHover && tapCount === 0) {
      e.preventDefault();
      setTapCount(1);
      setOpen(true);
      setHasOpened(true);
    }
    // Second tap on touch devices - allow default link behavior
    // On hover devices, always allow default behavior
  };

  return (
    <Tooltip
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setHasOpened(true);
      }}
    >
      <TooltipTrigger asChild onClick={handleInteraction}>
        {children}
      </TooltipTrigger>
      <TooltipContent
        sideOffset={6}
        alignOffset={-12}
        className="bg-transparent"
        hideArrow
        align="start"
      >
        <div className="w-[300px] sm:w-[360px] md:w-[420px]">
          <BrowserWindow url={domain} className="h-auto w-full shadow-xl">
            <Screenshot domain={domain} enabled={hasOpened} />
          </BrowserWindow>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function BrowserWindow({
  children,
  url,
  className,
}: {
  children: React.ReactNode;
  url?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-block select-none overflow-hidden rounded-lg border",
        className,
      )}
    >
      {/* Top Chrome Bar */}
      <div
        className="flex h-6 items-center gap-2 border-zinc-200 border-b bg-zinc-100 px-2 dark:border-zinc-800 dark:bg-zinc-900"
        aria-hidden
      >
        {/* Traffic Light Dots */}
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-[#FF5F57]" />
          <div className="h-2 w-2 rounded-full bg-[#FEBC2E]" />
          <div className="h-2 w-2 rounded-full bg-[#28C840]" />
        </div>

        {/* Address Bar */}
        <div className="flex h-3.5 flex-1 items-center rounded-sm bg-zinc-200 px-2 dark:bg-zinc-800">
          <span className="inline-block w-full truncate text-center text-[8px] text-zinc-500 dark:text-zinc-400">
            <a href={`https://${url}`} target="_blank" rel="noopener">
              {url}
            </a>
          </span>
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white dark:bg-zinc-950">{children}</div>
    </div>
  );
}
