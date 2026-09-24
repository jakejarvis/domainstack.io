export function Favicon({ domain }: { domain: string }) {
  return <span aria-hidden data-domain={domain} />;
}

export function ProviderLogo({
  providerId,
}: {
  providerId?: string | null;
  providerName?: string | null;
}) {
  if (!providerId) {
    return null;
  }
  return <span aria-hidden data-provider-logo={providerId} />;
}

export function ScreenshotPopover({ children }: { children: React.ReactNode }) {
  return children;
}

export function CalendarFeedPopover() {
  return null;
}

export function useProviderTooltipData() {
  return {
    isOpen: false,
    setIsOpen: () => undefined,
    shouldShowTooltip: false,
    isLoading: false,
  };
}
