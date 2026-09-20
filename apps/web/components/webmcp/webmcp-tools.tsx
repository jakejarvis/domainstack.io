"use client";

import { useEffect } from "react";

import { useTRPCClient } from "@/lib/trpc/client";
import { getModelContext } from "@/lib/webmcp/model-context";

/**
 * Registers the domain lookup tools with WebMCP so in-browser agents can call
 * them directly instead of driving the search form. Renders nothing, and only
 * downloads the tool code in browsers that actually expose WebMCP.
 */
export function WebMcpTools() {
  const trpc = useTRPCClient();

  useEffect(() => {
    const modelContext = getModelContext();
    if (!modelContext) return;

    const controller = new AbortController();
    void (async () => {
      const { registerDomainTools } = await import("@/lib/webmcp/register-tools");
      if (!controller.signal.aborted) {
        registerDomainTools(modelContext, trpc, controller.signal);
      }
    })();

    return () => controller.abort();
  }, [trpc]);

  return null;
}
