/**
 * Logging utilities for the chat workflow.
 *
 * Provides serialization helpers, error extraction, and workflow step functions
 * for structured logging of chat events.
 */

import {
  InvalidToolInputError,
  NoSuchToolError,
  ToolCallRepairError,
  type UIMessage,
} from "ai";
import { getStepMetadata, getWorkflowMetadata } from "workflow";

// ============================================================================
// Types
// ============================================================================

export type SerializedError = {
  name?: string;
  message?: string;
  stack?: string;
  cause?: SerializedError | string | null;
};

export type ToolErrorDetails = {
  type:
    | "no_such_tool"
    | "invalid_tool_input"
    | "tool_call_repair"
    | "tool_execution";
  toolName?: string;
  toolInput?: string;
  availableTools?: string[];
  originalError?: {
    type: "no_such_tool" | "invalid_tool_input";
    toolName?: string;
    toolInput?: string;
    availableTools?: string[];
  };
};

export type StuckToolPart = {
  toolType: string;
  toolCallId?: string;
  input?: unknown;
  errorText?: string;
};

export type ToolStepStats = {
  totalSteps: number;
  toolCalls: number;
  toolResults: number;
};

export type ToolCallSummary = {
  toolName?: string;
  toolCallId?: string;
};

export type ToolResultSummary = {
  toolName?: string;
  toolCallId?: string;
  isError?: boolean;
};

// ============================================================================
// Serialization Helpers
// ============================================================================

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const { name, message, stack, cause: rawCause } = error;
    let cause: SerializedError | string | null | undefined;
    if (rawCause instanceof Error) {
      cause = serializeError(rawCause);
    } else if (typeof rawCause === "string") {
      cause = rawCause;
    } else if (rawCause === null) {
      cause = null;
    }
    return { name, message, stack, cause };
  }
  return { message: String(error) };
}

export function getToolErrorDetails(
  error: unknown,
): ToolErrorDetails | undefined {
  if (NoSuchToolError.isInstance(error)) {
    return {
      type: "no_such_tool",
      toolName: error.toolName,
      availableTools: error.availableTools,
    };
  }

  if (InvalidToolInputError.isInstance(error)) {
    return {
      type: "invalid_tool_input",
      toolName: error.toolName,
      toolInput: error.toolInput,
    };
  }

  if (ToolCallRepairError.isInstance(error)) {
    const origErr = error.originalError;
    return {
      type: "tool_call_repair",
      originalError: NoSuchToolError.isInstance(origErr)
        ? {
            type: "no_such_tool",
            toolName: origErr.toolName,
            availableTools: origErr.availableTools,
          }
        : {
            type: "invalid_tool_input",
            toolName: origErr.toolName,
            toolInput: origErr.toolInput,
          },
    };
  }

  return;
}

export function summarizeToolCalls(toolCalls: unknown[]): ToolCallSummary[] {
  return toolCalls.map((call) => {
    if (!call || typeof call !== "object") {
      return {};
    }

    const toolName =
      "toolName" in call && typeof call.toolName === "string"
        ? call.toolName
        : "name" in call && typeof call.name === "string"
          ? call.name
          : undefined;

    const toolCallId =
      "toolCallId" in call && typeof call.toolCallId === "string"
        ? call.toolCallId
        : "id" in call && typeof call.id === "string"
          ? call.id
          : undefined;

    return { toolName, toolCallId };
  });
}

export function summarizeToolResults(
  toolResults: unknown[],
): ToolResultSummary[] {
  return toolResults.map((result) => {
    if (!result || typeof result !== "object") {
      return {};
    }

    const toolName =
      "toolName" in result && typeof result.toolName === "string"
        ? result.toolName
        : "name" in result && typeof result.name === "string"
          ? result.name
          : undefined;

    const toolCallId =
      "toolCallId" in result && typeof result.toolCallId === "string"
        ? result.toolCallId
        : "id" in result && typeof result.id === "string"
          ? result.id
          : undefined;

    const isError =
      "isError" in result && typeof result.isError === "boolean"
        ? result.isError
        : undefined;

    return { toolName, toolCallId, isError };
  });
}

export function getStuckToolParts(messages: UIMessage[]): StuckToolPart[] {
  const stuckTools: StuckToolPart[] = [];
  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (
        part &&
        typeof part === "object" &&
        "type" in part &&
        typeof part.type === "string" &&
        part.type.startsWith("tool-") &&
        "state" in part &&
        (part.state === "input-available" || part.state === "output-error")
      ) {
        const typedPart = part as {
          type: string;
          toolCallId?: string;
          input?: unknown;
          errorText?: string;
          state: string;
        };
        stuckTools.push({
          toolType: typedPart.type,
          toolCallId: typedPart.toolCallId,
          input: typedPart.input,
          errorText: typedPart.errorText,
        });
      }
    }
  }
  return stuckTools;
}

export function getToolStepStats(steps: unknown[]): ToolStepStats {
  let toolCalls = 0;
  let toolResults = 0;
  for (const step of steps) {
    if (step && typeof step === "object") {
      if ("toolCalls" in step && Array.isArray(step.toolCalls)) {
        toolCalls += step.toolCalls.length;
      }
      if ("toolResults" in step && Array.isArray(step.toolResults)) {
        toolResults += step.toolResults.length;
      }
    }
  }
  return {
    totalSteps: steps.length,
    toolCalls,
    toolResults,
  };
}

// ============================================================================
// Workflow Step Functions
// ============================================================================

export async function logChatStreamErrorStep(payload: {
  event: "chat_stream_error";
  domain?: string;
  userId?: string | null;
  error: SerializedError;
  tool?: ToolErrorDetails;
}) {
  "use step";
  const { createLogger } = await import("@/lib/logger/server");
  const logger = createLogger({ source: "chat/workflow" });
  const { workflowRunId } = getWorkflowMetadata();
  const { stepId } = getStepMetadata();
  logger.error({ ...payload, workflowRunId, stepId }, "chat stream error");
}

export async function logChatStepFinishStep(payload: {
  event: "chat_step_finish";
  domain?: string;
  userId?: string | null;
  finishReason?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  toolCalls: ToolCallSummary[];
  toolResults: ToolResultSummary[];
}) {
  "use step";
  const { createLogger } = await import("@/lib/logger/server");
  const logger = createLogger({ source: "chat/workflow" });
  const { workflowRunId } = getWorkflowMetadata();
  const { stepId } = getStepMetadata();
  logger.info({ ...payload, workflowRunId, stepId }, "chat step finished");
}

export async function logChatStreamWarningStep(payload: {
  event: "chat_tool_missing_result";
  domain?: string;
  userId?: string | null;
  stuckTools: StuckToolPart[];
  stepStats: ToolStepStats;
}) {
  "use step";
  const { createLogger } = await import("@/lib/logger/server");
  const logger = createLogger({ source: "chat/workflow" });
  const { workflowRunId } = getWorkflowMetadata();
  const { stepId } = getStepMetadata();
  logger.warn(
    { ...payload, workflowRunId, stepId },
    "chat stream finished with unresolved tool calls",
  );
}
