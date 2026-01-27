"use client";

import {
  IconLayoutSidebarRightCollapse,
  IconLego,
  IconMessageCircleFilled,
} from "@tabler/icons-react";
import { useSetAtom } from "jotai";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { useStacky } from "@/hooks/use-stacky";
import { serverSuggestionsAtom } from "@/lib/atoms/chat-atoms";
import { CHATBOT_NAME } from "@/lib/constants/ai";
import { usePreferencesStore } from "@/lib/stores/preferences-store";
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
  const hideAiFeatures = usePreferencesStore((s) => s.hideAiFeatures);
  const setHideAiFeatures = usePreferencesStore((s) => s.setHideAiFeatures);
  const {
    messages,
    sendMessage,
    status,
    domain,
    error,
    clearError,
    clearMessages,
  } = useStacky();

  // Hydrate server suggestions into atom
  const setServerSuggestions = useSetAtom(serverSuggestionsAtom);
  useEffect(() => {
    setServerSuggestions(suggestions);
  }, [suggestions, setServerSuggestions]);

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

  const handleChatClick = () => {
    try {
      navigator.vibrate([50]);
    } catch {}
    setOpen(!open);
  };

  const handleSettingsClick = () => {
    // Close the chat first to avoid z-index conflicts with the dialog
    setOpen(false);
    setSettingsOpen(true);
  };

  return (
    <>
      <AnimatePresence>
        {!hideAiFeatures && (
          <Tooltip>
            <TooltipTrigger
              render={
                <MotionButton
                  variant="default"
                  size="icon-lg"
                  aria-label={`Chat with ${CHATBOT_NAME}`}
                  className="fixed right-6 bottom-6 z-40 rounded-full shadow-lg transition-none"
                  onClick={handleChatClick}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  transition={{
                    duration: 0.25,
                    ease: [0.22, 1, 0.36, 1] as const,
                  }}
                >
                  <IconMessageCircleFilled className="size-5 text-background/95" />
                </MotionButton>
              }
            />
            <TooltipContent side="left" sideOffset={8}>
              Chat with {CHATBOT_NAME}
            </TooltipContent>
          </Tooltip>
        )}
      </AnimatePresence>

      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen} handleOnly>
          <DrawerContent>
            <DrawerHeader className="flex flex-row items-center justify-between">
              <DrawerTitle className="flex items-center gap-2">
                <IconLego className="size-4" />
                <span className="font-semibold text-[15px] leading-none tracking-tight">
                  {CHATBOT_NAME}
                </span>
                <BetaBadge />
              </DrawerTitle>
              <div className="flex items-center gap-2">
                <ChatHeaderActions
                  messages={messages}
                  onClear={clearMessages}
                  onSettingsClick={handleSettingsClick}
                  onCloseClick={() => setOpen(false)}
                />
              </div>
            </DrawerHeader>
            <ChatClient
              {...chatClientProps}
              conversationClassName="px-4"
              inputClassName="p-4"
            />
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="right"
            className="flex w-[420px] flex-col gap-0 p-0"
            showCloseButton={false}
          >
            <SheetHeader className="flex shrink-0 flex-row items-center justify-between border-b bg-card/60 px-3.5 py-2">
              <SheetTitle className="flex items-center gap-2">
                <IconLego className="size-4" />
                <span className="font-semibold text-[15px] leading-none tracking-tight">
                  {CHATBOT_NAME}
                </span>
                <BetaBadge />
              </SheetTitle>
              <div className="-mr-1.5 flex items-center gap-1.5">
                <ChatHeaderActions
                  messages={messages}
                  onClear={clearMessages}
                  onSettingsClick={handleSettingsClick}
                  onCloseClick={() => setOpen(false)}
                  closeIcon={IconLayoutSidebarRightCollapse}
                />
              </div>
            </SheetHeader>
            <ChatClient {...chatClientProps} inputClassName="p-3" />
          </SheetContent>
        </Sheet>
      )}

      <ChatSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
