import { ProviderTooltipContent } from "@/components/dashboard/provider-tooltip-content";
import { ProviderLogo } from "@/components/icons/provider-logo";
import { useProviderTooltipData } from "@/hooks/use-provider-tooltip-data";
import { useTruncation } from "@/hooks/use-truncation";
import type { ProviderCategory, ProviderInfo } from "@domainstack/types";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";
import { cn } from "@domainstack/ui/utils";

type ProviderCellProps = {
  provider: ProviderInfo;
  trackedDomainId: string;
  providerType: ProviderCategory;
  logoClassName?: string;
};

/** Provider logo and name, with a lazy details tooltip (or the full name when truncated). */
export function ProviderCell({
  provider,
  trackedDomainId,
  providerType,
  logoClassName = "size-[13px]",
}: ProviderCellProps) {
  const { valueRef, isTruncated } = useTruncation();

  const tooltipData = useProviderTooltipData({
    provider,
    trackedDomainId,
    providerType,
  });

  if (!provider.name) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const providerContent = (
    <span className="flex min-w-0 items-center gap-1.5">
      {provider.id && (
        <ProviderLogo
          providerId={provider.id}
          providerName={provider.name}
          className={cn("shrink-0", logoClassName)}
        />
      )}
      <span ref={valueRef} className="min-w-0 flex-1 truncate">
        {provider.name}
      </span>
    </span>
  );

  if (tooltipData.shouldShowTooltip) {
    return (
      <ResponsiveTooltip open={tooltipData.isOpen} onOpenChange={tooltipData.setIsOpen}>
        <ResponsiveTooltipTrigger nativeButton={false} render={providerContent} />
        <ResponsiveTooltipContent>
          <ProviderTooltipContent
            {...tooltipData}
            providerName={provider.name}
            providerType={providerType}
          />
        </ResponsiveTooltipContent>
      </ResponsiveTooltip>
    );
  }

  if (isTruncated) {
    return (
      <ResponsiveTooltip>
        <ResponsiveTooltipTrigger nativeButton={false} render={providerContent} />
        <ResponsiveTooltipContent>{provider.name}</ResponsiveTooltipContent>
      </ResponsiveTooltip>
    );
  }

  return providerContent;
}
