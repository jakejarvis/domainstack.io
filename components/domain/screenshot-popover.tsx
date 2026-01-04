import { useEffect, useState } from "react";
import { Screenshot } from "@/components/domain/screenshot";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { usePointerCapability } from "@/hooks/use-pointer-capability";

export function ScreenshotPopover({
  domain,
  children,
  align,
  alignOffset,
  side,
  sideOffset,
}: {
  domain: string;
  children: React.ReactElement;
} & Pick<
  React.ComponentProps<typeof PopoverContent>,
  "align" | "alignOffset" | "side" | "sideOffset"
>) {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const { isTouchDevice } = usePointerCapability();

  // Reset tap count when popover closes
  useEffect(() => {
    if (!open) {
      setTapCount(0);
    }
  }, [open]);

  const handleInteraction = (e: React.MouseEvent<HTMLElement>) => {
    // On touch devices, implement two-tap behavior
    if (isTouchDevice && tapCount === 0) {
      e.preventDefault();
      setTapCount(1);
      setOpen(true);
      setHasOpened(true);
    }
    // Second tap on touch devices - allow default link behavior
    // On hover devices, always allow default behavior
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setHasOpened(true);
      }}
    >
      <PopoverTrigger
        nativeButton={false}
        openOnHover
        delay={0}
        closeDelay={300}
        onClick={handleInteraction}
        render={children}
      />
      <PopoverContent
        className="w-auto border-0 bg-transparent p-0 shadow-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <div className="w-[300px] sm:w-[360px] md:w-[420px]">
          <div className="inline-block h-auto w-full select-none overflow-hidden rounded-lg border shadow-xl">
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
                  <a href={`https://${domain}`} target="_blank" rel="noopener">
                    {domain}
                  </a>
                </span>
              </div>
            </div>

            {/* Content Area */}
            <div className="bg-white dark:bg-zinc-950">
              <Screenshot domain={domain} enabled={hasOpened} />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
