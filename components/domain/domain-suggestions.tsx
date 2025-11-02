import { DomainSuggestionsClient } from "@/components/domain/domain-suggestions-client";
import { getDefaultSuggestions } from "@/lib/edge-config";

export async function DomainSuggestions({
  className,
  faviconSize = 16,
  max = 5,
}: {
  className?: string;
  faviconSize?: number;
  max?: number;
}) {
  const defaultSuggestions = await getDefaultSuggestions();

  return (
    <DomainSuggestionsClient
      defaultSuggestions={defaultSuggestions}
      className={className}
      faviconSize={faviconSize}
      max={max}
    />
  );
}
