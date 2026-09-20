/**
 * Cloud chat system prompt, managed in PostHog Prompt Management.
 *
 * The prompt text and the AI Gateway model id both live on the PostHog
 * prompt version (`config.model`), so either can change without a deploy.
 * There is no local fallback: if PostHog can't be reached or the prompt is
 * misconfigured, the chat turn fails rather than running on stale text.
 */

import { FatalError } from "workflow";

import { DOMAIN_TOOL_DEFS, type DomainToolSection } from "@/lib/chat/domain-tools";
import { domainContext, formatPromptDate } from "@/lib/chat/system-prompt";

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
 * Step: fetch and compile the cloud chat system prompt from PostHog, and
 * resolve the AI Gateway model id from its `config.model`.
 */
export async function resolveCloudPromptStep(domain?: string): Promise<CloudPrompt> {
  "use step";

  const personalApiKey = process.env.POSTHOG_API_KEY;
  const projectApiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!personalApiKey || !projectApiKey) {
    throw new Error(
      "POSTHOG_API_KEY and NEXT_PUBLIC_POSTHOG_KEY are required to fetch the cloud chat prompt from PostHog",
    );
  }

  const { Prompts } = await import("@posthog/ai");
  const prompts = new Prompts({
    personalApiKey,
    projectApiKey,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
  });

  const result = await prompts.get(CLOUD_PROMPT_NAME);
  if (result.source === "code_fallback") {
    throw new Error(`PostHog prompt "${CLOUD_PROMPT_NAME}" could not be fetched`);
  }

  const model = result.config?.model;
  if (typeof model !== "string" || model.length === 0) {
    throw new FatalError(
      `PostHog prompt "${CLOUD_PROMPT_NAME}" is missing a string "model" in its config`,
    );
  }

  const prompt = prompts.compile(result.prompt, {
    today: formatPromptDate(),
    domainContext: domainContext(domain),
    domainTools: DOMAIN_TOOLS,
    overviewTools: OVERVIEW_TOOLS,
  });

  return { prompt, model, promptName: result.name, promptVersion: result.version };
}
