import {
  HomeSearchSuggestionsClient,
  type HomeSearchSuggestionsClientProps,
} from "@/components/search/home-search-suggestions-client";
import { getDefaultSuggestions } from "@/lib/edge-config";

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
