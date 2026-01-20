"use client";

import {
  ChatDotsIcon,
  ChatsIcon,
  CheckIcon,
  CopyIcon,
  GearIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { UIMessage } from "ai";
import { useEffect, useState } from "react";
import { ChatClient } from "@/components/chat/chat-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAiPreferences } from "@/hooks/use-ai-preferences";
import { useDomainChat } from "@/hooks/use-domain-chat";
import { useIsMobile } from "@/hooks/use-mobile";
import { CHATBOT_NAME } from "@/lib/constants/ai";

const fabClassName = "fixed right-6 bottom-6 z-40 rounded-full shadow-lg";

function formatMessagesAsMarkdown(messages: UIMessage[]): string {
  return messages
    .map((message) => {
      const role = message.role === "user" ? "User" : "Assistant";
      const textParts = message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n\n");
      return `**${role}:** ${textParts}`;
    })
    .join("\n\n---\n\n");
}

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
      // Silently fail
    }
  };

  const Icon = copied ? CheckIcon : CopyIcon;
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
        <TrashIcon className="size-4" />
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
        <GearIcon className="size-4" />
      </TooltipTrigger>
      <TooltipContent>Settings</TooltipContent>
    </Tooltip>
  );
}

function ChatSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { hideAiFeatures, setHideAiFeatures } = useAiPreferences();

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Chat Settings</DialogTitle>
        </DialogHeader>
        <Item size="sm" variant="default" className="rounded-lg p-0">
          <ItemContent>
            <ItemTitle>
              <Label htmlFor="hide-ai" className="cursor-pointer">
                Hide AI features
              </Label>
            </ItemTitle>
            <ItemDescription className="text-xs">
              {hideAiFeatures ? (
                <>
                  To restore, visit any page with{" "}
                  <code className="rounded bg-muted px-1 text-[11px]">
                    ?show_ai=1
                  </code>
                </>
              ) : (
                <>Removes the chat button from all pages</>
              )}
            </ItemDescription>
          </ItemContent>
          <Switch
            id="hide-ai"
            checked={hideAiFeatures}
            onCheckedChange={setHideAiFeatures}
          />
        </Item>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChatHeaderActions({
  messages,
  onClear,
  onSettingsClick,
}: {
  messages: UIMessage[];
  onClear: () => void;
  onSettingsClick: () => void;
}) {
  return (
    <>
      {messages.length > 0 && (
        <>
          <CopyConversationButton messages={messages} />
          <ClearChatButton onClick={onClear} />
        </>
      )}
      <ChatSettingsButton onClick={onSettingsClick} />
    </>
  );
}

export function ChatTrigger() {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();
  const { hideAiFeatures, setHideAiFeatures } = useAiPreferences();
  const {
    messages,
    sendMessage,
    status,
    domain,
    error,
    clearError,
    clearMessages,
  } = useDomainChat();

  // Wait for client-side hydration to read localStorage
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check for ?show_ai=1 URL param to re-enable AI features
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("show_ai") === "1" && hideAiFeatures) {
      setHideAiFeatures(false);
      // Clean up URL
      params.delete("show_ai");
      const newUrl =
        params.toString() === ""
          ? window.location.pathname
          : `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, "", newUrl);
    }
  }, [hideAiFeatures, setHideAiFeatures]);

  // Don't render until mounted (localStorage has been read)
  // Then hide if AI features are hidden and settings dialog is closed
  if (!mounted || (hideAiFeatures && !settingsOpen)) {
    return null;
  }

  const handleSettingsClick = () => {
    // Close the popover/drawer first to avoid z-index conflicts with the dialog
    setOpen(false);
    setSettingsOpen(true);
  };

  const chatClientProps = {
    messages,
    sendMessage,
    status,
    domain,
    error,
    onClearError: clearError,
  };

  // Show chat UI only when AI features are not hidden
  const showChatUI = !hideAiFeatures;

  return (
    <>
      {showChatUI && isMobile && (
        <>
          <Button
            variant="default"
            size="icon-lg"
            onClick={() => setOpen(true)}
            aria-label={`Chat with ${CHATBOT_NAME}`}
            className={fabClassName}
          >
            <ChatDotsIcon className="size-5 text-background/95" weight="fill" />
          </Button>
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerContent className="flex max-h-[85vh] flex-col">
              <DrawerHeader className="flex h-12 flex-row items-center justify-between">
                <DrawerTitle className="flex items-center gap-2">
                  <ChatsIcon className="size-4" />
                  {CHATBOT_NAME}
                </DrawerTitle>
                <div className="flex items-center gap-1">
                  <ChatHeaderActions
                    messages={messages}
                    onClear={clearMessages}
                    onSettingsClick={handleSettingsClick}
                  />
                </div>
              </DrawerHeader>
              <ChatClient
                {...chatClientProps}
                iconSize="lg"
                conversationClassName="px-4"
                inputClassName="p-4 pb-safe"
              />
            </DrawerContent>
          </Drawer>
        </>
      )}
      {showChatUI && !isMobile && (
        <Popover open={open} onOpenChange={setOpen}>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <Button
                      variant="default"
                      size="icon-lg"
                      aria-label={`Chat with ${CHATBOT_NAME}`}
                      className={fabClassName}
                    >
                      <ChatDotsIcon
                        className="size-5 text-background/95"
                        weight="fill"
                      />
                    </Button>
                  }
                />
              }
            />
            <TooltipContent side="left" sideOffset={8}>
              Chat with {CHATBOT_NAME}
            </TooltipContent>
          </Tooltip>
          <PopoverContent
            side="top"
            align="end"
            sideOffset={12}
            collisionPadding={16}
            className="flex h-[min(480px,70vh)] w-[380px] flex-col gap-0 bg-background/95 p-0 backdrop-blur-sm"
          >
            <PopoverHeader className="flex h-12 shrink-0 flex-row items-center justify-between border-border/60 border-b px-4 py-3">
              <PopoverTitle className="flex items-center gap-2">
                <ChatsIcon className="size-4" />
                {CHATBOT_NAME}
              </PopoverTitle>
              <div className="-mr-2 flex items-center gap-1">
                <ChatHeaderActions
                  messages={messages}
                  onClear={clearMessages}
                  onSettingsClick={handleSettingsClick}
                />
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Close"
                        onClick={() => setOpen(false)}
                      />
                    }
                  >
                    <XIcon className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent>Close</TooltipContent>
                </Tooltip>
              </div>
            </PopoverHeader>
            <ChatClient {...chatClientProps} inputClassName="p-3" />
          </PopoverContent>
        </Popover>
      )}
      <ChatSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
