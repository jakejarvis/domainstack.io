import { cacheLife } from "next/cache";

import { landingSuggestions } from "@/lib/flags";

import { ChatClientLazy } from "./chat-client-lazy";

/** Question templates - each takes a domain and returns a suggestion */
const QUESTION_TEMPLATES = [
  (d: string) => `Look up ${d}`,
  (d: string) => `What security headers does ${d} have?`,
  (d: string) => `Who is the registrar for ${d}?`,
  (d: string) => `Check SSL for ${d}`,
  (d: string) => `When does ${d} expire?`,
  (d: string) => `What DNS records does ${d} have?`,
  (d: string) => `Which email provider does ${d} use?`,
];

/** Fisher-Yates shuffle */
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Shared suggestion list for the cache window. Shuffle is legal inside
 * `"use cache"` because the result is captured and reused across visitors.
 */
async function getChatSuggestions(domains: string[]): Promise<string[]> {
  "use cache";
  cacheLife("hours");

  // No domains configured means no suggestions; also avoids a modulo by zero below.
  if (domains.length === 0) return [];

  // Shuffle both domains and questions, then pair them up
  const shuffledDomains = shuffle(domains);
  const shuffledTemplates = shuffle(QUESTION_TEMPLATES);

  return shuffledTemplates
    .slice(0, 4)
    .map((template, i) => template(shuffledDomains[i % shuffledDomains.length]));
}

/**
 * Server component wrapper that generates cached suggestions
 * using domains from the `landing-suggestions` flag.
 *
 * The flag is read here rather than inside `getChatSuggestions`: flag
 * evaluation reads request headers, which is not allowed inside `"use cache"`.
 * The resolved list is passed in as an argument, so it joins the cache key.
 */
export async function ChatServer() {
  const suggestions = await getChatSuggestions(await landingSuggestions());
  return <ChatClientLazy suggestions={suggestions} />;
}
