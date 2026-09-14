"use client";

import { useAtom } from "jotai";
import { AnimatePresence } from "motion/react";
import { type ComponentType, useCallback, useEffect, useRef, useState } from "react";

import { chatOpenAtom } from "@/lib/atoms/chat-atoms";
import { usePreferencesHydrated, usePreferencesStore } from "@/lib/stores/preferences-store";

import { ChatFab } from "./chat-fab";

interface LoadedChatClientProps {
  suggestions?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReady: () => void;
}

type ChatClientModule = { ChatClient: ComponentType<LoadedChatClientProps> };
type ChatClientLoader = () => Promise<ChatClientModule>;

const loadChatClient: ChatClientLoader = () => import("./chat-client");

export function ChatClientLazy({
  suggestions,
  loader = loadChatClient,
}: {
  suggestions?: string[];
  loader?: ChatClientLoader;
}) {
  const hydrated = usePreferencesHydrated();
  const hideAiFeatures = usePreferencesStore((s) => s.hideAiFeatures);
  const setHideAiFeatures = usePreferencesStore((s) => s.setHideAiFeatures);
  const [open, setOpen] = useAtom(chatOpenAtom);
  const [ChatClient, setChatClient] = useState<ComponentType<LoadedChatClientProps> | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const loadingRef = useRef(false);

  // Check for ?show_ai=1 URL param to re-enable AI features
  // Must live here since ChatClient may not be loaded yet
  useEffect(() => {
    if (!hydrated) return;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("show_ai") === "1" && hideAiFeatures) {
      setHideAiFeatures(false);
      urlParams.delete("show_ai");
      const newUrl =
        urlParams.toString() === ""
          ? window.location.pathname
          : `${window.location.pathname}?${urlParams.toString()}`;
      window.history.replaceState({}, "", newUrl);
    }
  }, [hydrated, hideAiFeatures, setHideAiFeatures]);

  useEffect(() => {
    if (hideAiFeatures) setOpen(false);
  }, [hideAiFeatures, setOpen]);

  const handleActivation = useCallback(() => {
    if (ChatClient) {
      setOpen((current) => !current);
      return;
    }
    if (loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setLoadError(false);
    setOpen(true);

    void loader()
      .then((module) => {
        setChatClient(() => module.ChatClient);
        return undefined;
      })
      .catch(() => {
        loadingRef.current = false;
        setLoading(false);
        setLoadError(true);
        setOpen(false);
      });
  }, [ChatClient, loader, setOpen]);

  const handleReady = useCallback(() => {
    loadingRef.current = false;
    setLoading(false);
  }, []);

  if (!hydrated) return null;

  return (
    <>
      <AnimatePresence>
        {!hideAiFeatures && <ChatFab loading={loading} onClick={handleActivation} />}
      </AnimatePresence>
      {loadError && (
        <p className="sr-only" aria-live="polite">
          Chat failed to load. Try again.
        </p>
      )}
      {ChatClient && (
        <ChatClient
          suggestions={suggestions}
          open={open}
          onOpenChange={setOpen}
          onReady={handleReady}
        />
      )}
    </>
  );
}
