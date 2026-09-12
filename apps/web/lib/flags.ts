/**
 * Vercel Flags declarations.
 *
 * Flags are managed in the Vercel dashboard (or via `vercel flags`) and
 * evaluated through the OIDC-authenticated `vercelAdapter`. Each flag needs a
 * `defaultValue` so evaluation failures and archived flags degrade gracefully.
 */

import { vercelAdapter } from "@flags-sdk/vercel";
import { flag } from "flags/next";

/**
 * AI Gateway model identifier used by the chat agent.
 *
 * IMPORTANT: For reliable tool calling, use models known to support
 * it well.
 * See: https://vercel.com/ai-gateway/models (Provider support table)
 *
 * Flag key: `ai-model`
 */
export const aiModel = flag<string>({
  key: "ai-model",
  description: "AI Gateway model identifier used by the chat agent",
  defaultValue: "google/gemini-3.5-flash-lite",
  adapter: vercelAdapter,
});

/**
 * Domain suggestions shown on the landing page and in chat prompts.
 *
 * The default doubles as the built-in fallback list, so call sites do not need
 * one of their own. An explicitly empty flag value means "show no suggestions".
 *
 * Flag key: `landing-suggestions`
 */
export const landingSuggestions = flag<string[]>({
  key: "landing-suggestions",
  description: "Domains suggested on the landing page and in chat prompts",
  defaultValue: ["vercel.com", "github.com", "stackoverflow.com", "chatgpt.com"],
  adapter: vercelAdapter,
});

/**
 * Source URLs for the screenshot blocklist sync.
 *
 * An empty list disables syncing, which leaves all domains allowed.
 *
 * Flag key: `blocklist-sources`
 */
export const blocklistSources = flag<string[]>({
  key: "blocklist-sources",
  description: "Source URLs synced into the screenshot blocklist",
  defaultValue: [],
  adapter: vercelAdapter,
});
