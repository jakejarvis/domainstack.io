import {
  type ChatStatus,
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
  type ReasoningUIPart,
  type UIMessage,
} from "ai";

type MessagePart = UIMessage["parts"][number];

const RUNNING_TOOL_STATES = new Set(["input-streaming", "input-available", "approval-requested"]);

export type AssistantWaitKind = "thinking" | "working";
export type AssistantWaitPlacement = "none" | "standalone" | "inline";

export type AssistantWaitStatus = {
  placement: AssistantWaitPlacement;
  kind: AssistantWaitKind | null;
};

export function getMessagePartKey(messageId: string, part: MessagePart, position: number): string {
  if (isToolUIPart(part) && "toolCallId" in part && typeof part.toolCallId === "string") {
    return `${messageId}-${part.toolCallId}`;
  }
  return `${messageId}-${part.type}-${position}`;
}

export type AssistantRenderItem =
  | { kind: "part"; key: string; part: MessagePart; position: number }
  | {
      kind: "reasoning";
      key: string;
      text: string;
      lastPosition: number;
      isStreaming: boolean;
    };

/**
 * Consecutive reasoning parts are merged into one block, matching the AI
 * Elements pattern for models that emit multiple reasoning chunks.
 */
export function getAssistantRenderItems(message: UIMessage): AssistantRenderItem[] {
  const items: AssistantRenderItem[] = [];
  const { parts } = message;
  let i = 0;

  while (i < parts.length) {
    const part = parts[i];
    if (!part) {
      i += 1;
      continue;
    }

    if (isReasoningUIPart(part)) {
      const start = i;
      const texts: string[] = [];
      let last: ReasoningUIPart = part;

      while (i < parts.length && isReasoningUIPart(parts[i]!)) {
        last = parts[i] as ReasoningUIPart;
        texts.push(last.text);
        i += 1;
      }

      items.push({
        kind: "reasoning",
        key: getMessagePartKey(message.id, part, start),
        text: texts.join("\n\n"),
        lastPosition: i - 1,
        isStreaming: last.state === "streaming",
      });
      continue;
    }

    items.push({
      kind: "part",
      key: getMessagePartKey(message.id, part, i),
      part,
      position: i,
    });
    i += 1;
  }

  return items;
}

function isNonEmptyTextPart(part: MessagePart): boolean {
  return isTextUIPart(part) && part.text.trim().length > 0;
}

function isRunningToolPart(part: MessagePart): boolean {
  return isToolUIPart(part) && RUNNING_TOOL_STATES.has(part.state);
}

export function hasVisibleAssistantParts(
  message: UIMessage,
  options: { showReasoning: boolean; showToolCalls: boolean },
): boolean {
  return message.parts.some((part) => {
    if (isTextUIPart(part)) {
      return isNonEmptyTextPart(part);
    }
    if (isReasoningUIPart(part)) {
      return options.showReasoning;
    }
    if (isToolUIPart(part)) {
      return options.showToolCalls;
    }
    return false;
  });
}

function isWaitingOnHiddenReasoning(
  lastPart: MessagePart,
  options: { showReasoning: boolean },
): boolean {
  return isReasoningUIPart(lastPart) && !options.showReasoning && lastPart.state !== "done";
}

/**
 * Wait indicator while the model is working but the user is not already
 * seeing in-progress output (streaming text, visible reasoning, or a running tool).
 *
 * "Thinking" is reserved for a reasoning part. Everything else in this gap
 * (first token, post-tool `step-start`, empty streaming text) is "Working".
 */
export function getAssistantWaitStatus(
  status: ChatStatus,
  messages: UIMessage[],
  options: { showReasoning: boolean; showToolCalls: boolean },
): AssistantWaitStatus {
  if (status !== "submitted" && status !== "streaming") {
    return { placement: "none", kind: null };
  }

  const lastMessage = messages.at(-1);
  if (!lastMessage || lastMessage.role !== "assistant") {
    return { placement: "standalone", kind: "working" };
  }

  const lastPart = lastMessage.parts.at(-1);
  if (!lastPart) {
    const placement = hasVisibleAssistantParts(lastMessage, options) ? "inline" : "standalone";
    return { placement, kind: "working" };
  }

  if (options.showToolCalls && lastMessage.parts.some(isRunningToolPart)) {
    return { placement: "none", kind: null };
  }

  if (isTextUIPart(lastPart)) {
    const isPlaceholder = lastPart.text.trim().length === 0;
    if (!isPlaceholder || lastPart.state === "done") {
      return { placement: "none", kind: null };
    }
  } else if (isReasoningUIPart(lastPart) && options.showReasoning) {
    return { placement: "none", kind: null };
  }

  const kind: AssistantWaitKind = isWaitingOnHiddenReasoning(lastPart, options)
    ? "thinking"
    : "working";
  const placement = hasVisibleAssistantParts(lastMessage, options) ? "inline" : "standalone";
  return { placement, kind };
}
