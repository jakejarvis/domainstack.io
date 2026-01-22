"use client";

import { ChatDotsIcon, LegoSmileyIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { BetaBadge } from "@/components/beta-badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAiPreferences } from "@/hooks/use-ai-preferences";
import { useDomainChat } from "@/hooks/use-domain-chat";
import { useIsMobile } from "@/hooks/use-mobile";
import { CHATBOT_NAME } from "@/lib/constants/ai";
import { ChatClient } from "./chat-client";
import { ChatHeaderActions } from "./chat-header-actions";
import { ChatSettingsDialog } from "./chat-settings-dialog";

const MotionButton = motion.create(Button);

interface ChatTriggerClientProps {
  /** Pre-generated suggestions from server */
  suggestions?: string[];
}

export function ChatTriggerClient({
  suggestions = [],
}: ChatTriggerClientProps) {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();
  const prefersReducedMotion = useReducedMotion();
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

  // Props passed to ChatClient (no useMemo needed since ChatClient is not memoized)
  const chatClientProps = {
    messages,
    sendMessage,
    clearMessages,
    status,
    domain,
    error,
    onClearError: clearError,
    suggestions,
  };

  // Don't render until mounted (localStorage has been read)
  // Keep settings dialog available if it was open when AI features got hidden
  if (!mounted) {
    return null;
  }

  // If AI features are hidden, only render the settings dialog (if open)
  if (hideAiFeatures && !settingsOpen) {
    return null;
  }

  const handleSettingsClick = () => {
    // Close the popover/drawer first to avoid z-index conflicts with the dialog
    setOpen(false);
    setSettingsOpen(true);
  };

  // Show chat UI only when AI features are not hidden
  const showChatUI = !hideAiFeatures;

  // Shared FAB button with entrance animation
  const fabButton = (
    <MotionButton
      variant="default"
      size="icon-lg"
      aria-label={`Chat with ${CHATBOT_NAME}`}
      className="fixed right-6 bottom-6 z-40 rounded-full shadow-lg transition-none"
      onClick={isMobile ? () => setOpen(true) : undefined}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] as const }}
    >
      <ChatDotsIcon className="size-5 text-background/95" weight="fill" />
    </MotionButton>
  );

  // Shared header actions
  const headerActions = (
    <ChatHeaderActions
      messages={messages}
      onClear={clearMessages}
      onSettingsClick={handleSettingsClick}
      onCloseClick={() => setOpen(false)}
    />
  );

  return (
    <>
      {isMobile && (
        <>
          <AnimatePresence>{showChatUI && fabButton}</AnimatePresence>
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerContent className="flex h-[min(530px,85vh)] flex-col overscroll-contain">
              <DrawerHeader className="flex h-12 flex-row items-center justify-between">
                <DrawerTitle className="flex items-center gap-2">
                  <LegoSmileyIcon className="size-4" />
                  <span className="text-base leading-none tracking-tight">
                    {CHATBOT_NAME}
                  </span>
                  <BetaBadge />
                </DrawerTitle>
                <div className="flex items-center gap-2">{headerActions}</div>
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

      {!isMobile && (
        <Popover open={open} onOpenChange={setOpen}>
          <AnimatePresence>
            {showChatUI && (
              <Tooltip>
                <TooltipTrigger
                  render={<PopoverTrigger render={fabButton} />}
                />
                <TooltipContent side="left" sideOffset={8}>
                  Chat with {CHATBOT_NAME}
                </TooltipContent>
              </Tooltip>
            )}
          </AnimatePresence>
          <PopoverContent
            side="top"
            align="end"
            sideOffset={12}
            collisionPadding={16}
            className="flex h-[min(530px,85vh)] w-[410px] flex-col gap-0 overscroll-contain bg-background/95 p-0 backdrop-blur-sm"
          >
            <PopoverHeader className="flex h-12 shrink-0 flex-row items-center justify-between border-border/60 border-b px-4 py-3">
              <PopoverTitle className="flex items-center gap-2">
                <LegoSmileyIcon className="size-4" />
                <span className="text-base leading-none tracking-tight">
                  {CHATBOT_NAME}
                </span>
                <BetaBadge />
              </PopoverTitle>
              <div className="-mr-2 flex items-center gap-1">
                {headerActions}
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
