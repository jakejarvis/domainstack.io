import type { LanguageModel } from "ai";

/**
 * Resolve the AI Gateway model ID from Edge Config.
 * Runs as a step to keep Node.js modules out of the workflow sandbox.
 *
 * WorkflowAgent serializes `model` across step boundaries, so this returns a
 * gateway LanguageModel instance (plain provider config). Correlation IDs go
 * on `runtimeContext` / telemetry.
 */
export async function getModelStep(): Promise<LanguageModel> {
  "use step";

  const { createGateway } = await import("@ai-sdk/gateway");
  const gateway = createGateway({
    headers: {
      // Opt into the Vercel leaderboard: https://vercel.com/docs/ai-gateway/app-attribution
      "http-referer": "https://domainstack.io",
      "x-title": "Domainstack",
    },
  });

  const { getAiChatModel } = await import("@domainstack/server/edge-config");
  const { DEFAULT_CHAT_MODEL } = await import("@domainstack/constants");
  const modelId = await getAiChatModel();
  return gateway(modelId || DEFAULT_CHAT_MODEL);
}
