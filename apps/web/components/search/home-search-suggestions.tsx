import { getDefaultSuggestions } from "@domainstack/server/edge-config";
import {
  HomeSearchSuggestionsClient,
  type HomeSearchSuggestionsClientProps,
} from "@/components/search/home-search-suggestions-client";

export async function DomainSuggestions(
  props: Omit<HomeSearchSuggestionsClientProps, "defaultSuggestions">,
) {
  const defaultSuggestions = await getDefaultSuggestions();

  return (
    <HomeSearchSuggestionsClient
      defaultSuggestions={defaultSuggestions}
      {...props}
    />
  );
}
