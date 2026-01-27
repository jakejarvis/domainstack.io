import type { CompatibleLanguageModel } from "@workflow/ai/agent";
import { getStepMetadata, getWorkflowMetadata } from "workflow";

/**
 * Create the AI model instance and wrap with PostHog tracing.
 * Runs as a step to keep Node.js modules out of workflow sandbox.
 */
export async function getModelStep(): Promise<CompatibleLanguageModel> {
  "use step";

  // Create the AI model instance
  const { createGateway } = await import("@ai-sdk/gateway");
  const gateway = createGateway({
    headers: {
      // Opt into the Vercel leaderboard: https://vercel.com/docs/ai-gateway/app-attribution
      "http-referer": "https://domainstack.io",
      "x-title": "Domainstack",
    },
  });

  // Get the AI model ID from Edge Config, fallback to constants string
  const { getAiChatModel } = await import("@/lib/edge-config");
  const { DEFAULT_CHAT_MODEL } = await import("@domainstack/constants");
  const modelId = await getAiChatModel();
  const model = gateway(modelId || DEFAULT_CHAT_MODEL);

  // Wrap with PostHog tracing if client available
  const { getServerPosthog } = await import("@/lib/analytics/server");
  const phClient = getServerPosthog();
  if (phClient) {
    // Get workflow run ID and step ID for PostHog trace correlation
    const { workflowRunId } = getWorkflowMetadata();
    const { stepId } = getStepMetadata();

    const { withTracing } = await import("@posthog/ai");
    return withTracing(model, phClient, {
      // TODO: it seems we can't choose what arguments DurableAgent passes in (if any), will revisit this later
      // posthogDistinctId: userId || ip || undefined,
      posthogTraceId: workflowRunId,
      posthogProperties: {
        workflow_run_id: workflowRunId,
        step_id: stepId,
      },
    }) as CompatibleLanguageModel;
  }

  return model as CompatibleLanguageModel;
}
