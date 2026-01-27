"use client";

import { IconArrowRight, IconCircleX, IconSearch } from "@tabler/icons-react";
import { useParams } from "next/navigation";
import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { useIsMac } from "@/hooks/use-is-mac";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRouter } from "@/hooks/use-router";
import { analytics } from "@/lib/analytics/client";
import { isValidDomain, normalizeDomainInput } from "@/lib/domain-utils";
import { useHomeSearchStore } from "@/lib/stores/home-search-store";
import { cn } from "@/lib/utils";

export type SearchClientVariant = "sm" | "lg";

export type SearchClientProps = {
  variant?: SearchClientVariant;
  initialValue?: string;
  onFocusChangeAction?: (isFocused: boolean) => void;
};

export function SearchClient({
  variant = "lg",
  initialValue = "",
  onFocusChangeAction,
}: SearchClientProps) {
  const router = useRouter();
  const params = useParams<{ domain?: string }>();
  const isMac = useIsMac();
  const isMobile = useIsMobile();

  // Home search store for suggestion click coordination
  const pendingDomain = useHomeSearchStore((s) => s.pendingDomain);
  const setPendingDomain = useHomeSearchStore((s) => s.setPendingDomain);

  // Derive initial value from route (header) or prop (homepage)
  const prefillFromRoute = variant === "sm";
  const derivedInitial = useMemo(() => {
    if (prefillFromRoute) {
      const raw = params?.domain ? decodeURIComponent(params.domain) : "";
      const normalized = normalizeDomainInput(raw);
      return isValidDomain(normalized) ? normalized : "";
    }
    const normalized = normalizeDomainInput(initialValue);
    return isValidDomain(normalized) ? normalized : "";
  }, [prefillFromRoute, params?.domain, initialValue]);

  // Input state
  const [value, setValue] = useState(derivedInitial);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync value when route/initial changes
  useEffect(() => {
    setValue(derivedInitial);
    setLoading(false);
  }, [derivedInitial]);

  // Mount effect for hydration
  useEffect(() => setMounted(true), []);

  // Keyboard shortcut (⌘/Ctrl+K)
  useHotkeys(
    "mod+k",
    (e) => {
      e.preventDefault();
      inputRef.current?.focus();
    },
    {
      enableOnFormTags: false,
    },
    [variant],
  );

  // Navigation helper
  function navigateToDomain(domain: string) {
    const target = normalizeDomainInput(domain);
    analytics.track("search_submitted", { domain: target });

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

  // Form submission
  function submit() {
    const normalized = normalizeDomainInput(value);
    const isValid = isValidDomain(normalized);

    if (!isValid) {
      analytics.track("search_invalid_input", { input: value });
      toast.error("Please enter a valid domain.", {
        icon: createElement(IconCircleX, { className: "h-4 w-4" }),
        position: "bottom-center",
      });
      inputRef.current?.focus();
      return;
    }
    navigateToDomain(normalized);
  }

  // Store function ref to avoid unnecessary effect re-runs
  const navigateRef = useRef(navigateToDomain);
  navigateRef.current = navigateToDomain;

  // Handle pending domain from suggestion clicks (variant="lg" only)
  useEffect(() => {
    if (variant === "lg" && pendingDomain) {
      setValue(pendingDomain);
      navigateRef.current(pendingDomain);
      setPendingDomain(null);
    }
  }, [variant, pendingDomain, setPendingDomain]);

  // Select all on first focus from keyboard or first click; allow precise cursor on next click.
  const pointerDownRef = useRef(false);
  const justFocusedRef = useRef(false);

  function handlePointerDown() {
    if (variant !== "sm") return;
    pointerDownRef.current = true;
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    setIsFocused(true);
    onFocusChangeAction?.(true);
    if (!pointerDownRef.current) {
      e.currentTarget.select();
      justFocusedRef.current = false;
    } else {
      justFocusedRef.current = true;
      pointerDownRef.current = false;
    }
  }

  function handleBlur() {
    setIsFocused(false);
    onFocusChangeAction?.(false);
  }

  function handleClick(e: React.MouseEvent<HTMLInputElement>) {
    if (e.detail === 3) {
      e.currentTarget.select();
      justFocusedRef.current = false;
      return;
    }
    if (justFocusedRef.current && e.detail === 1) {
      e.currentTarget.select();
    }
    justFocusedRef.current = false;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.blur();
      setIsFocused(false);
      onFocusChangeAction?.(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <form
        aria-label="Domain search"
        onSubmit={(e) => {
          e.preventDefault();
          setIsFocused(false);
          inputRef.current?.blur();
          submit();
        }}
      >
        <Field>
          <FieldLabel htmlFor="domain" className="sr-only">
            Domain
          </FieldLabel>
          <div className="relative w-full flex-1">
            <InputGroup className={cn(variant === "lg" ? "h-12" : "h-10")}>
              <InputGroupInput
                id="domain"
                ref={inputRef}
                autoFocus={variant === "lg"}
                inputMode="url"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={loading}
                placeholder={
                  variant === "lg"
                    ? "domainstack.io"
                    : isMobile
                      ? "Search"
                      : "Search any domain"
                }
                aria-label="Search any domain"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onPointerDown={handlePointerDown}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                className="relative truncate sm:translate-y-[1px]"
              />

              <InputGroupAddon>
                <IconSearch />
              </InputGroupAddon>

              {variant === "sm" && (loading || mounted) && (
                <InputGroupAddon align="inline-end">
                  {loading ? (
                    <Spinner />
                  ) : (
                    <Kbd className="hidden border bg-muted/80 px-1.5 py-0.5 sm:inline-flex">
                      {isFocused ? "Esc" : isMac ? "⌘\u00A0K" : "Ctrl\u00A0K"}
                    </Kbd>
                  )}
                </InputGroupAddon>
              )}

              {variant === "lg" && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="submit"
                    disabled={loading}
                    className="mx-1 h-8 disabled:pointer-events-none"
                    variant="ghost"
                  >
                    {loading && <Spinner />}
                    <div className="flex items-center gap-2">
                      <span className="text-[13px]">Inspect</span>
                      <Kbd className="hidden text-[13px] sm:inline-flex">⏎</Kbd>
                      <IconArrowRight className="inline-flex sm:hidden" />
                    </div>
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
          </div>
        </Field>
      </form>
    </div>
  );
}
