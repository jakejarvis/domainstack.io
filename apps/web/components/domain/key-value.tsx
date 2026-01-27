import { CopyButton } from "@domainstack/ui/copy-button";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";
import { cn } from "@domainstack/ui/utils";
import { useTruncation } from "@/hooks/use-truncation";

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
        "flex h-16 min-w-0 items-center justify-between gap-4 rounded-xl border bg-background/60 px-4 py-3 backdrop-blur-lg",
        highlight
          ? "border-accent-purple/20 bg-accent-purple/5 dark:border-accent-purple/12"
          : "border-border",
      )}
    >
      <div className="flex min-w-0 flex-col space-y-1.5">
        {label && (
          <div
            className={cn(
              "pt-1 text-[10px] uppercase leading-none tracking-[0.08em]",
              highlight
                ? "text-accent-purple"
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

          <ResponsiveTooltip>
            <ResponsiveTooltipTrigger
              nativeButton={false}
              render={
                <span ref={valueRef} className="min-w-0 flex-1 truncate">
                  {value}
                </span>
              }
            />
            <ResponsiveTooltipContent
              className={cn(
                isTruncated || valueTooltip != null
                  ? "max-w-[80vw] whitespace-pre-wrap break-words md:max-w-[40rem]"
                  : "hidden",
              )}
            >
              {valueTooltip ?? value}
            </ResponsiveTooltipContent>
          </ResponsiveTooltip>

          {suffix ? (
            <span className="leading-none [&_img]:block [&_img]:h-4 [&_img]:w-4 [&_span]:leading-none [&_svg]:block [&_svg]:h-4 [&_svg]:w-4">
              {suffix}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {trailing}
        {copyable && <CopyButton value={value} variant="ghost" />}
      </div>
    </div>
  );
}
