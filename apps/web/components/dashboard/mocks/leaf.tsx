import type { ReactNode } from "react";

export function Favicon({ domain }: { domain: string }) {
  return <span aria-hidden data-domain={domain} />;
}

export function ProviderLogo({ providerName }: { providerName: string | null | undefined }) {
  return <span data-testid="provider-logo">{providerName}</span>;
}

export function ScreenshotPopover({ children }: { children: ReactNode }) {
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
