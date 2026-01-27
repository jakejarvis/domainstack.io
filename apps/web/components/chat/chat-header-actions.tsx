"use client";

import {
  IconCheck,
  IconCopy,
  IconSettings,
  IconTrash,
  IconX,
  type TablerIcon,
} from "@tabler/icons-react";
import type { UIMessage } from "ai";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatMessagesAsMarkdown } from "./utils";

function CopyConversationButton({ messages }: { messages: UIMessage[] }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
      return;
    }

    try {
      const markdown = formatMessagesAsMarkdown(messages);
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy conversation");
    }
  };

  const Icon = copied ? IconCheck : IconCopy;
  const label = copied ? "Copied!" : "Copy conversation";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCopy}
            aria-label={label}
          />
        }
      >
        <Icon className="size-4" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ClearChatButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClick}
            aria-label="Clear chat"
          />
        }
      >
        <IconTrash className="size-4" />
      </TooltipTrigger>
      <TooltipContent>Clear chat</TooltipContent>
    </Tooltip>
  );
}

function ChatSettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Settings"
            onClick={onClick}
          />
        }
      >
        <IconSettings className="size-4" />
      </TooltipTrigger>
      <TooltipContent>Settings</TooltipContent>
    </Tooltip>
  );
}

function CloseChatButton({
  onClick,
  icon: CloseIcon = IconX,
}: {
  onClick: () => void;
  icon?: TablerIcon;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            onClick={onClick}
          />
        }
      >
        <CloseIcon className="size-4" />
      </TooltipTrigger>
      <TooltipContent>Close</TooltipContent>
    </Tooltip>
  );
}

export interface ChatHeaderActionsProps {
  messages: UIMessage[];
  onClear: () => void;
  onSettingsClick: () => void;
  onCloseClick: () => void;
  closeIcon?: TablerIcon;
}

export function ChatHeaderActions({
  messages,
  onClear,
  onSettingsClick,
  onCloseClick,
  closeIcon,
}: ChatHeaderActionsProps) {
  return (
    <>
      {messages.length > 0 && (
        <>
          <CopyConversationButton messages={messages} />
          <ClearChatButton onClick={onClear} />
        </>
      )}
      <ChatSettingsButton onClick={onSettingsClick} />
      <CloseChatButton onClick={onCloseClick} icon={closeIcon} />
    </>
  );
}
