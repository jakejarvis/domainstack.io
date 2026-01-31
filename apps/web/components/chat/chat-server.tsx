import { getDefaultSuggestions } from "@domainstack/server/edge-config";
import { ChatClient } from "./chat-client";

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

/** Fallback domains when Edge Config is empty */
const FALLBACK_DOMAINS = [
  "vercel.com",
  "github.com",
  "stackoverflow.com",
  "chatgpt.com",
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
 * Server component wrapper that generates randomized suggestions
 * using domains from Edge Config.
 */
export async function ChatServer() {
  const configDomains = await getDefaultSuggestions();
  const domains = configDomains.length > 0 ? configDomains : FALLBACK_DOMAINS;

  // Shuffle both domains and questions, then pair them up
  const shuffledDomains = shuffle(domains);
  const shuffledTemplates = shuffle(QUESTION_TEMPLATES);

  const suggestions = shuffledTemplates
    .slice(0, 4)
    .map((template, i) =>
      template(shuffledDomains[i % shuffledDomains.length]),
    );

  return <ChatClient suggestions={suggestions} />;
}
