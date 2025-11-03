import {
  DomainSuggestionsClient,
  type DomainSuggestionsClientProps,
} from "@/components/domain/domain-suggestions-client";
import { getDefaultSuggestions } from "@/lib/edge-config";

export async function DomainSuggestions(
  props: Omit<DomainSuggestionsClientProps, "defaultSuggestions">,
) {
  const defaultSuggestions = await getDefaultSuggestions();

  return (
    <DomainSuggestionsClient
      defaultSuggestions={defaultSuggestions}
      {...props}
    />
  );
}
