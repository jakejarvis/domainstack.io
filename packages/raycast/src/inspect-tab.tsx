import { Detail } from "@raycast/api";
import { DomainDetail } from "./components/domain-detail";
import { ErrorView } from "./components/error-view";
import { useBrowserTab } from "./hooks/use-browser-tab";
import { useDomainLookup } from "./hooks/use-domain-lookup";

export default function InspectTab() {
  const {
    domain,
    isLoading: isBrowserLoading,
    error: browserError,
  } = useBrowserTab();
  const {
    data,
    isLoading: isDataLoading,
    error: dataError,
    revalidate,
  } = useDomainLookup({ domain });

  // Browser tab loading
  if (isBrowserLoading) {
    return <Detail isLoading={true} markdown="Getting URL from browser..." />;
  }

  // Browser error
  if (browserError) {
    return <ErrorView title="Browser Error" message={browserError} />;
  }

  // No domain extracted
  if (!domain) {
    return (
      <ErrorView
        title="No Domain Found"
        message="Could not extract a valid domain from the current browser tab."
      />
    );
  }

  // Data loading
  if (!data || isDataLoading) {
    return (
      <DomainDetail
        domain={domain}
        data={{
          registration: null,
          dns: null,
          hosting: null,
          certificates: null,
          headers: null,
          seo: null,
        }}
        isLoading={true}
      />
    );
  }

  // Data error
  if (dataError) {
    return (
      <ErrorView
        title="Lookup Failed"
        message={dataError.message}
        onRetry={revalidate}
      />
    );
  }

  // Success - show domain detail
  return <DomainDetail domain={domain} data={data} isLoading={false} />;
}
