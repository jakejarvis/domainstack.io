import type { CompatibleLanguageModel } from "@workflow/ai/agent";

/**
 * Fetch the AI model and wrap with PostHog tracing.
 * Runs as a step to keep Node.js modules out of workflow sandbox.
 *
 * @param userId - User ID for PostHog distinct ID attribution
 * @param ip - IP address for ID fallback
 * @param domain - Domain being queried (optional, for observability only)
 */
export async function getModelStep(
  userId: string | null,
  ip: string | null,
  domain: string | undefined,
): Promise<CompatibleLanguageModel> {
  "use step";

  const { createGateway } = await import("@ai-sdk/gateway");
  const { withTracing } = await import("@posthog/ai");
  const { getServerPosthog } = await import("@/lib/analytics/server");
  const { getAiChatModel } = await import("@/lib/edge-config");
  const { DEFAULT_CHAT_MODEL } = await import("@/lib/constants/ai");
  const { getWorkflowMetadata, getStepMetadata } = await import("workflow");

  // Get workflow run ID and step ID for PostHog trace correlation
  const { workflowRunId } = getWorkflowMetadata();
  const { stepId } = getStepMetadata();

  const gateway = createGateway({
    headers: {
      // Opt into the Vercel leaderboard: https://vercel.com/docs/ai-gateway/app-attribution
      "http-referer": "https://domainstack.io",
      "x-title": "Domainstack",
    },
  });

  const modelId = await getAiChatModel();
  const baseModel = gateway(modelId ?? DEFAULT_CHAT_MODEL);

  // Wrap with PostHog tracing if client available
  const phClient = getServerPosthog();
  if (phClient) {
    return withTracing(baseModel, phClient, {
      posthogDistinctId: userId || ip || undefined,
      posthogTraceId: workflowRunId,
      posthogProperties: {
        domain,
        workflow_run_id: workflowRunId,
        step_id: stepId,
      },
    }) as CompatibleLanguageModel;
  }

  return baseModel as CompatibleLanguageModel;
}
