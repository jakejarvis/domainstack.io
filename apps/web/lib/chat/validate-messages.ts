import { safeValidateUIMessages, tool, type UIMessage } from "ai";

import { DOMAIN_TOOL_DEFS, domainToolInputSchema } from "./domain-tools";

function createDomainToolSchemas() {
  return Object.fromEntries(
    DOMAIN_TOOL_DEFS.map((def) => [
      def.name,
      tool({
        description: def.description,
        inputSchema: domainToolInputSchema,
      }),
    ]),
  );
}

/**
 * Validate client-owned chat history against the current domain tool schemas.
 * Size limits are enforced separately by `chatRequestSchema`.
 */
export async function validateChatMessages(
  messages: unknown,
): Promise<{ success: true; data: UIMessage[] } | { success: false; error: Error }> {
  const result = await safeValidateUIMessages({
    messages,
    tools: createDomainToolSchemas() as never,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, data: result.data };
}
