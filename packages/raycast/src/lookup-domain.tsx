import {
  Action,
  ActionPanel,
  Form,
  Icon,
  showToast,
  Toast,
} from "@raycast/api";
import { useState } from "react";
import { DomainDetail } from "./components/domain-detail";
import { ErrorView } from "./components/error-view";
import { useDomainLookup } from "./hooks/use-domain-lookup";
import { extractDomain } from "./utils/domain";

interface LookupDomainArguments {
  domain?: string;
}

export default function LookupDomain(props: {
  arguments: LookupDomainArguments;
}) {
  const initialDomain = props.arguments.domain
    ? extractDomain(props.arguments.domain)
    : null;

  const [domain, setDomain] = useState<string | null>(initialDomain);
  const [inputValue, setInputValue] = useState(props.arguments.domain ?? "");
  const [inputError, setInputError] = useState<string | undefined>();

  const { data, isLoading, error, revalidate } = useDomainLookup({ domain });

  // If domain provided via argument, show results directly
  if (domain && data) {
    return <DomainDetail domain={domain} data={data} isLoading={isLoading} />;
  }

  // If loading with a domain
  if (domain && isLoading) {
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

  // If error occurred
  if (error) {
    return (
      <ErrorView
        title="Lookup Failed"
        message={error.message}
        onRetry={() => {
          if (domain) {
            revalidate();
          }
        }}
      />
    );
  }

  // Show form for domain input
  function handleSubmit(values: { domain: string }) {
    const normalized = extractDomain(values.domain);

    if (!normalized) {
      setInputError("Please enter a valid domain (e.g., example.com)");
      return;
    }

    setInputError(undefined);
    setDomain(normalized);

    void showToast({
      style: Toast.Style.Animated,
      title: "Looking up domain...",
      message: normalized,
    });
  }

  function handleChange(value: string) {
    setInputValue(value);

    // Clear error when user starts typing again
    if (inputError) {
      setInputError(undefined);
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Lookup Domain"
            icon={Icon.MagnifyingGlass}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="domain"
        title="Domain"
        placeholder="example.com"
        value={inputValue}
        onChange={handleChange}
        error={inputError}
        autoFocus
      />
      <Form.Description
        title=""
        text="Enter a domain name to look up WHOIS, DNS, SSL, hosting, and SEO information."
      />
    </Form>
  );
}
