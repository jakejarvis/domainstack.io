/**
 * Build the system prompt with domain context.
 */
export async function buildSystemPromptStep(domain?: string): Promise<string> {
  "use step";

  const { buildSystemPrompt } = await import("@/lib/chat/system-prompt");
  return buildSystemPrompt({ variant: "cloud", domain });
}
