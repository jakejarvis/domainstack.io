/**
 * Cloud chat system prompt, managed in PostHog Prompt Management.
 *
 * The prompt text and the AI Gateway model id both live on the PostHog
 * prompt version (`config.model`), so either can change without a deploy.
 * There is no hardcoded fallback. The prompt is cached in-process for the
 * library's default TTL (5 minutes), so edits in PostHog take effect within
 * that window, and a failed refresh serves the last version PostHog returned.
 * A cold instance with PostHog unreachable (or a misconfigured prompt) still
 * fails the chat turn rather than running on stale text.
 *
 * Resolved once in the API route, before the workflow starts (not as a
 * workflow step): a step's default retries would delay a fail-fast error,
 * and a failure inside the workflow body can't reach the route's response
 * (start() only awaits the run being enqueued, not the run finishing).
 */

import type { Prompts } from "@posthog/ai";

import { DOMAIN_TOOL_DEFS, type DomainToolSection } from "@/lib/chat/domain-tools";
import { domainContext, formatPromptDate, sanitizeDomain } from "@/lib/chat/system-prompt";

/**
 * Prompt name in PostHog. Immutable once created there (letters, numbers,
 * hyphens, and underscores only).
 */
const CLOUD_PROMPT_NAME = "cloud-chat-system-prompt";

const TOOL_NAMES = Object.fromEntries(
  DOMAIN_TOOL_DEFS.map((def) => [def.section, def.name]),
) as Record<DomainToolSection, string>;

const OVERVIEW_SECTIONS = ["registration", "dns", "certificates", "hosting"] as const;
const OVERVIEW_TOOLS = OVERVIEW_SECTIONS.map((section) => TOOL_NAMES[section]).join(", ");
const DOMAIN_TOOLS = ([...OVERVIEW_SECTIONS, "headers", "seo"] as const)
  .map((section) => TOOL_NAMES[section])
  .join(", ");

export interface CloudPrompt {
  prompt: string;
  model: string;
  promptName: string;
  promptVersion: number;
}

/**
 * One client per process: `Prompts` keeps its fetch cache on the instance, so
 * a new instance per turn would never hit it.
 */
let promptsClient: Prompts | undefined;

async function getPromptsClient(personalApiKey: string, projectApiKey: string): Promise<Prompts> {
  if (!promptsClient) {
    const { Prompts } = await import("@posthog/ai");
    promptsClient = new Prompts({
      personalApiKey,
      projectApiKey,
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    });
  }
  return promptsClient;
}

/**
 * Fetch and compile the cloud chat system prompt from PostHog, and resolve
 * the AI Gateway model id from its `config.model`.
 */
export async function resolveCloudPrompt(domain?: string): Promise<CloudPrompt> {
  const personalApiKey = process.env.POSTHOG_API_KEY;
  const projectApiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!personalApiKey || !projectApiKey) {
    throw new Error(
      "POSTHOG_API_KEY and NEXT_PUBLIC_POSTHOG_KEY are required to fetch the cloud chat prompt from PostHog",
    );
  }

  const prompts = await getPromptsClient(personalApiKey, projectApiKey);

  const result = await prompts.get(CLOUD_PROMPT_NAME);
  if (result.source === "code_fallback") {
    throw new Error(`PostHog prompt "${CLOUD_PROMPT_NAME}" could not be fetched`);
  }

  const model = typeof result.config?.model === "string" ? result.config.model.trim() : undefined;
  if (!model) {
    throw new Error(
      `PostHog prompt "${CLOUD_PROMPT_NAME}" is missing a string "model" in its config`,
    );
  }

  const prompt = prompts.compile(result.prompt, {
    today: formatPromptDate(),
    domainContext: domainContext(sanitizeDomain(domain)),
    domainTools: DOMAIN_TOOLS,
    overviewTools: OVERVIEW_TOOLS,
  });

  return { prompt, model, promptName: result.name, promptVersion: result.version };
}
