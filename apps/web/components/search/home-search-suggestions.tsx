import {
  HomeSearchSuggestionsClient,
  type HomeSearchSuggestionsClientProps,
} from "@/components/search/home-search-suggestions-client";
import { landingSuggestions } from "@/lib/flags";

export async function DomainSuggestions(
  props: Omit<HomeSearchSuggestionsClientProps, "defaultSuggestions">,
) {
  const defaultSuggestions = await landingSuggestions();

  return <HomeSearchSuggestionsClient defaultSuggestions={defaultSuggestions} {...props} />;
}
