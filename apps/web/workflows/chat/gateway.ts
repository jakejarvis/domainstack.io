/**
 * Resolve the AI Gateway model ID from Edge Config.
 * Runs as a step to keep Node.js modules out of the workflow sandbox.
 *
 * Return a string, not a LanguageModel instance. WorkflowAgent resolves
 * gateway model IDs inside its own stream step; returning a provider class
 * from this step fails production serialization (minified class, no classId).
 */
export async function getModelStep(): Promise<string> {
  "use step";

  const { getAiChatModel } = await import("@domainstack/edge-config");
  const { DEFAULT_CHAT_MODEL } = await import("@domainstack/constants");
  const modelId = await getAiChatModel();
  return modelId || DEFAULT_CHAT_MODEL;
}
