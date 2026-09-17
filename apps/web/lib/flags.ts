/**
 * Vercel Flags declarations.
 */

import { vercelAdapter } from "@flags-sdk/vercel";
import type { Identify } from "flags";
import { dedupe, flag } from "flags/next";

import { getServerSession } from "@/lib/auth/session";

interface Entities {
  user?: {
    id: string;
  };
}

const identify: Identify<Entities> = dedupe(async (): Promise<Entities> => {
  const session = await getServerSession();
  return {
    user: session?.user
      ? {
          id: session.user.id,
        }
      : undefined,
  };
});

/**
 * AI Gateway model identifier used by the chat agent.
 *
 * IMPORTANT: For reliable tool calling, use models known to support
 * it well.
 * See: https://vercel.com/ai-gateway/models (Provider support table)
 *
 * Flag key: `ai-model`
 */
export const aiModel = flag<string, Entities>({
  key: "ai-model",
  description: "AI Gateway model identifier used by the chat agent",
  defaultValue: "google/gemini-3.5-flash-lite",
  adapter: vercelAdapter,
  identify,
});

/**
 * Domain suggestions shown on the landing page and in chat prompts.
 *
 * The default doubles as the built-in fallback list, so call sites do not need
 * one of their own. An explicitly empty flag value means "show no suggestions".
 *
 * Flag key: `landing-suggestions`
 */
export const landingSuggestions = flag<string[], Entities>({
  key: "landing-suggestions",
  description: "Domains suggested on the landing page and in chat prompts",
  defaultValue: [
    "jarv.is",
    "vercel.com",
    "github.com",
    "google.com",
    "stackoverflow.com",
    "chatgpt.com",
  ],
  adapter: vercelAdapter,
  identify,
});

/**
 * Source URLs for the screenshot blocklist sync.
 *
 * An empty list disables syncing, which leaves all domains allowed.
 *
 * Flag key: `blocklist-sources`
 */
export const blocklistSources = flag<string[], Entities>({
  key: "blocklist-sources",
  description: "Source URLs synced into the screenshot blocklist",
  defaultValue: [],
  adapter: vercelAdapter,
  identify,
});
