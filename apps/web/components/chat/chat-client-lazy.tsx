"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  usePreferencesHydrated,
  usePreferencesStore,
} from "@/lib/stores/preferences-store";

const DynamicChatClient = dynamic(
  () => import("./chat-client").then((m) => m.ChatClient),
  { ssr: false },
);

export function ChatClientLazy({ suggestions }: { suggestions?: string[] }) {
  const hydrated = usePreferencesHydrated();
  const hideAiFeatures = usePreferencesStore((s) => s.hideAiFeatures);
  const setHideAiFeatures = usePreferencesStore((s) => s.setHideAiFeatures);
  const [hasLoaded, setHasLoaded] = useState(false);

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

  // Once loaded, stay loaded (keeps settings dialog working when user disables AI)
  const shouldLoad = hydrated && !hideAiFeatures;
  useEffect(() => {
    if (shouldLoad) setHasLoaded(true);
  }, [shouldLoad]);

  if (!hasLoaded) return null;
  return <DynamicChatClient suggestions={suggestions} />;
}
