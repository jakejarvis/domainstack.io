import type { ChatStatus, UIMessage } from "ai";

type MessagePart = UIMessage["parts"][number];

export function isToolPart(part: MessagePart): boolean {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

export function getMessagePartKey(messageId: string, part: MessagePart, position: number): string {
  if (isToolPart(part) && "toolCallId" in part && typeof part.toolCallId === "string") {
    return `${messageId}-${part.toolCallId}`;
  }
  return `${messageId}-${part.type}-${position}`;
}

export function getMessagePartItems(message: UIMessage) {
  return message.parts.map((part, position) => ({
    key: getMessagePartKey(message.id, part, position),
    part,
    position,
  }));
}

export function hasVisibleAssistantParts(
  message: UIMessage,
  options: { showReasoning: boolean; showToolCalls: boolean },
): boolean {
  return message.parts.some((part) => {
    if (part.type === "text") {
      return "text" in part && typeof part.text === "string" && part.text.trim().length > 0;
    }
    if (part.type === "reasoning") {
      return options.showReasoning;
    }
    if (isToolPart(part)) {
      return options.showToolCalls;
    }
    return false;
  });
}

export function shouldShowThinkingStatus(
  status: ChatStatus,
  messages: UIMessage[],
  options: { showReasoning: boolean; showToolCalls: boolean },
): boolean {
  if (status !== "submitted" && status !== "streaming") {
    return false;
  }

  const lastMessage = messages.at(-1);
  if (!lastMessage || lastMessage.role !== "assistant") {
    return true;
  }

  return !hasVisibleAssistantParts(lastMessage, options);
}
