"use client";

import { ArrowRight, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { type Source, useDomainSearch } from "@/hooks/use-domain-search";
import { useIsMac } from "@/hooks/use-is-mac";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export type DomainSearchVariant = "sm" | "lg";

export type DomainSearchProps = {
  variant?: DomainSearchVariant;
  initialValue?: string;
  externalNavigation?: { domain: string; source: Source } | null;
  onNavigationCompleteAction?: () => void;
  onFocusChangeAction?: (isFocused: boolean) => void;
};

export function DomainSearch({
  variant = "lg",
  initialValue = "",
  externalNavigation,
  onNavigationCompleteAction,
  onFocusChangeAction,
}: DomainSearchProps) {
  const { value, setValue, loading, inputRef, submit, navigateToDomain } =
    useDomainSearch({
      initialValue,
      source: variant === "lg" ? "form" : "header",
      showInvalidToast: true,
      enableShortcut: variant === "sm", // header supports ⌘/Ctrl + K
      prefillFromRoute: variant === "sm", // header derives initial from route
    });

  const isMac = useIsMac();
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  useEffect(() => setMounted(true), []);

  // Store function refs to avoid unnecessary effect re-runs
  const navigateRef = useRef(navigateToDomain);
  const onCompleteRef = useRef(onNavigationCompleteAction);

  // Update refs when functions change
  useEffect(() => {
    navigateRef.current = navigateToDomain;
    onCompleteRef.current = onNavigationCompleteAction;
  }, [navigateToDomain, onNavigationCompleteAction]);

  // Handle external navigation requests (e.g., from suggestion clicks)
  useEffect(() => {
    if (externalNavigation) {
      // Mirror the selected domain in the input so the form appears submitted
      setValue(externalNavigation.domain);
      // Trigger navigation using ref to avoid dependency issues
      navigateRef.current(externalNavigation.domain, externalNavigation.source);
      // Notify parent that navigation was handled
      onCompleteRef.current?.();
    }
  }, [externalNavigation, setValue]);

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
    // If focus came from keyboard (e.g., Cmd/Ctrl+K), select immediately
    // and allow the next click to place the caret precisely.
    if (!pointerDownRef.current) {
      e.currentTarget.select();
      justFocusedRef.current = false;
    } else {
      // For pointer-initiated focus, wait for the first click to select all
      // so double-click can still select a word normally.
      justFocusedRef.current = true;
      pointerDownRef.current = false;
    }
  }

  function handleBlur() {
    setIsFocused(false);
    onFocusChangeAction?.(false);
  }

  function handleClick(e: React.MouseEvent<HTMLInputElement>) {
    // Triple-click: select entire value explicitly.
    if (e.detail === 3) {
      e.currentTarget.select();
      justFocusedRef.current = false;
      return;
    }
    // If this is the very first click after pointer-focus, select all on single click.
    // Double-click (detail 2) will use the browser's default word selection.
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
            <InputGroup
              className={cn(
                "border-none ring-1 ring-border/60",
                variant === "lg" ? "h-12" : "h-10",
              )}
            >
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
                className="relative top-0 truncate sm:top-px"
              />

              <InputGroupAddon>
                <Search />
              </InputGroupAddon>

              {variant === "sm" && (loading || mounted) && (
                <InputGroupAddon align="inline-end">
                  {loading ? (
                    <Spinner />
                  ) : (
                    <Kbd className="mx-1 hidden border bg-muted/80 px-1.5 py-0.5 sm:inline-flex">
                      {isFocused ? "Esc" : isMac ? "⌘ K" : "Ctrl+K"}
                    </Kbd>
                  )}
                </InputGroupAddon>
              )}

              {variant === "lg" && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="submit"
                    disabled={loading}
                    className="mx-1 h-8 cursor-pointer disabled:pointer-events-none"
                    variant="ghost"
                  >
                    {loading ? (
                      <Spinner />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-[13px]">Inspect</span>
                        <Kbd className="hidden text-[13px] sm:inline-flex">
                          ⏎
                        </Kbd>
                        <ArrowRight className="inline-flex sm:hidden" />
                      </div>
                    )}
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
