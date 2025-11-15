"use client";

import { CircleX } from "lucide-react";
import { useParams } from "next/navigation";
import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useRouter } from "@/hooks/use-router";
import { analytics } from "@/lib/analytics/client";
import { isValidDomain, normalizeDomainInput } from "@/lib/domain";

const domainSchema = z
  .string()
  .transform((v) => normalizeDomainInput(v))
  .refine((v) => isValidDomain(v), {
    message: "Please enter a valid domain.",
  });

export type Source = "form" | "header" | "suggestion";

export type UseDomainSearchOptions = {
  initialValue?: string;
  source?: Exclude<Source, "suggestion">;
  showInvalidToast?: boolean;
  enableShortcut?: boolean;
  shortcutKey?: string; // default: "k"
  prefillFromRoute?: boolean;
};

export function useDomainSearch(options: UseDomainSearchOptions = {}) {
  const {
    initialValue = "",
    source = "form",
    showInvalidToast = false,
    enableShortcut = false,
    shortcutKey = "k",
    prefillFromRoute = false,
  } = options;

  const router = useRouter();
  const params = useParams<{ domain?: string }>();

  const derivedInitial = useMemo(() => {
    if (prefillFromRoute) {
      const raw = params?.domain ? decodeURIComponent(params.domain) : "";
      const normalized = normalizeDomainInput(raw);
      return isValidDomain(normalized) ? normalized : "";
    }
    const normalized = normalizeDomainInput(initialValue);
    return isValidDomain(normalized) ? normalized : "";
  }, [prefillFromRoute, params?.domain, initialValue]);

  const [value, setValue] = useState<string>(derivedInitial);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(derivedInitial);

    // Also reset loading on navigation so inputs/buttons re-enable in header variant
    setLoading(false);
  }, [derivedInitial]);

  // Optional keyboard shortcut to focus the input (e.g., ⌘/Ctrl + K)
  useEffect(() => {
    if (!enableShortcut) return;
    function onKey(e: KeyboardEvent) {
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === shortcutKey || e.key === shortcutKey.toUpperCase())
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enableShortcut, shortcutKey]);

  function navigateToDomain(domain: string, navigateSource: Source = source) {
    const target = normalizeDomainInput(domain);
    analytics.track("search_submitted", {
      domain: target,
      source: navigateSource,
    });

    const current = params?.domain
      ? normalizeDomainInput(decodeURIComponent(params.domain))
      : null;

    setLoading(true);
    router.push(`/${encodeURIComponent(target)}`);

    // If pushing to the same route, Next won't navigate. Clear loading shortly
    // to avoid an infinite spinner when the path doesn't actually change.
    if (current && current === target) {
      setTimeout(() => setLoading(false), 300);
    }
  }

  function submit() {
    const parsed = domainSchema.safeParse(value);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues?.[0] as
        | { code?: string; message?: string }
        | undefined;
      analytics.track("search_invalid_input", {
        reason: firstIssue?.code ?? "invalid",
        value_length: value.length,
      });
      if (showInvalidToast) {
        toast.error(firstIssue?.message, {
          icon: createElement(CircleX, { className: "h-4 w-4" }),
          position: "bottom-center",
        });
        inputRef.current?.focus();
      }
      return;
    }
    navigateToDomain(parsed.data, source);
  }

  return {
    value,
    setValue,
    loading,
    inputRef,
    submit,
    navigateToDomain,
  } as const;
}
