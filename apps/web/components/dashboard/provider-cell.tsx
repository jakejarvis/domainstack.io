import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";
import { ProviderTooltipContent } from "@/components/dashboard/provider-tooltip-content";
import { ProviderLogo } from "@/components/icons/provider-logo";
import { useProviderTooltipData } from "@/hooks/use-provider-tooltip-data";
import { useTruncation } from "@/hooks/use-truncation";
import type { ProviderCategory } from "@/lib/constants/providers";
import type { ProviderInfo } from "@/lib/types/provider";

type ProviderCellProps = {
  provider: ProviderInfo;
  trackedDomainId: string;
  providerType: ProviderCategory;
};

export function ProviderCell({
  provider,
  trackedDomainId,
  providerType,
}: ProviderCellProps) {
  const { valueRef, isTruncated } = useTruncation();

  const tooltipData = useProviderTooltipData({
    provider,
    trackedDomainId,
    providerType,
  });

  if (!provider.name) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const providerContent = (
    <span className="flex min-w-0 items-center gap-1.5">
      {provider.id && (
        <ProviderLogo
          providerId={provider.id}
          providerName={provider.name}
          className="size-[13px] shrink-0"
        />
      )}
      <span ref={valueRef} className="min-w-0 flex-1 truncate">
        {provider.name}
      </span>
    </span>
  );

  if (tooltipData.shouldShowTooltip) {
    return (
      <ResponsiveTooltip
        open={tooltipData.isOpen}
        onOpenChange={tooltipData.setIsOpen}
      >
        <ResponsiveTooltipTrigger
          nativeButton={false}
          render={providerContent}
        />
        <ResponsiveTooltipContent>
          <ProviderTooltipContent
            providerId={tooltipData.providerId}
            providerName={provider.name}
            providerType={providerType}
            isLoading={tooltipData.isLoading}
            records={tooltipData.records}
            certificateExpiryDate={tooltipData.certificateExpiryDate}
            whoisServer={tooltipData.whoisServer}
            rdapServers={tooltipData.rdapServers}
            registrationSource={tooltipData.registrationSource}
            transferLock={tooltipData.transferLock}
            registrantInfo={tooltipData.registrantInfo}
          />
        </ResponsiveTooltipContent>
      </ResponsiveTooltip>
    );
  }

  if (isTruncated) {
    return (
      <ResponsiveTooltip>
        <ResponsiveTooltipTrigger
          nativeButton={false}
          render={providerContent}
        />
        <ResponsiveTooltipContent>{provider.name}</ResponsiveTooltipContent>
      </ResponsiveTooltip>
    );
  }

  return providerContent;
}
