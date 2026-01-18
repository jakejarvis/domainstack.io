"use client";

import { XCircleIcon } from "@phosphor-icons/react/ssr";
import { useParams } from "next/navigation";
import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { useRouter } from "@/hooks/use-router";
import { analytics } from "@/lib/analytics/client";
import { isValidDomain, normalizeDomainInput } from "@/lib/domain-utils";

interface UseDomainSearchOptions {
  initialValue?: string;
  showInvalidToast?: boolean;
  enableShortcut?: boolean;
  shortcutKey?: string; // default: "k"
  prefillFromRoute?: boolean;
}

export function useDomainSearch(options: UseDomainSearchOptions = {}) {
  const {
    initialValue = "",
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
  useHotkeys(
    `mod+${shortcutKey}`,
    (e) => {
      e.preventDefault();
      inputRef.current?.focus();
    },
    {
      enabled: enableShortcut,
      enableOnFormTags: false,
    },
    [enableShortcut, shortcutKey],
  );

  function navigateToDomain(domain: string) {
    const target = normalizeDomainInput(domain);
    analytics.track("search_submitted", {
      domain: target,
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
    const normalized = normalizeDomainInput(value);
    const isValid = isValidDomain(normalized);

    if (!isValid) {
      analytics.track("search_invalid_input", {
        input: value,
      });
      if (showInvalidToast) {
        toast.error("Please enter a valid domain.", {
          icon: createElement(XCircleIcon, {
            className: "h-4 w-4",
            weight: "bold",
          }),
          position: "bottom-center",
        });
        inputRef.current?.focus();
      }
      return;
    }
    navigateToDomain(normalized);
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
