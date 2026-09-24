/**
 * Vercel Flags declarations.
 */

import "server-only";
import { vercelAdapter } from "@flags-sdk/vercel";
import { flag } from "flags/next";

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
  defaultValue: [
    "jarv.is",
    "vercel.com",
    "github.com",
    "google.com",
    "stackoverflow.com",
    "chatgpt.com",
  ],
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
