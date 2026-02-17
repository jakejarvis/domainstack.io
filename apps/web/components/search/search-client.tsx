"use client";

import { analytics } from "@domainstack/analytics/client";
import { Field, FieldLabel } from "@domainstack/ui/field";
import { Form } from "@domainstack/ui/form";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@domainstack/ui/input-group";
import { Kbd } from "@domainstack/ui/kbd";
import { Spinner } from "@domainstack/ui/spinner";
import { cn } from "@domainstack/ui/utils";
import {
  isValidDomain,
  normalizeDomainInput,
} from "@domainstack/utils/domain/client";
import { IconArrowRight, IconCircleX, IconSearch } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRouter } from "@/hooks/use-router";
import { pendingDomainAtom } from "@/lib/atoms/search-atoms";

const isMac = () =>
  typeof navigator !== "undefined" &&
  // @ts-expect-error userAgentData not yet in all TS libs
  (navigator.userAgentData?.platform === "macOS" ||
    navigator.userAgent.includes("Mac"));

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
  const isMobile = useIsMobile();

  // Home search atom for suggestion click coordination
  const [pendingDomain, setPendingDomain] = useAtom(pendingDomainAtom);

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
  useHotkeys("mod+k", (e) => {
    e.preventDefault();
    inputRef.current?.focus();
  });

  // Navigation helper
  const navigateToDomain = (domain: string) => {
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
  };

  // Store function ref to avoid unnecessary effect re-runs
  const navigateRef = useRef(navigateToDomain);
  useEffect(() => {
    navigateRef.current = navigateToDomain;
  });

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

  const handlePointerDown = useCallback(() => {
    if (variant !== "sm") return;
    pointerDownRef.current = true;
  }, [variant]);

  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocusChangeAction?.(true);
      if (!pointerDownRef.current) {
        e.currentTarget.select();
        justFocusedRef.current = false;
      } else {
        justFocusedRef.current = true;
        pointerDownRef.current = false;
      }
    },
    [onFocusChangeAction],
  );

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onFocusChangeAction?.(false);
  }, [onFocusChangeAction]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    if (e.detail === 3) {
      e.currentTarget.select();
      justFocusedRef.current = false;
      return;
    }
    if (justFocusedRef.current && e.detail === 1) {
      e.currentTarget.select();
    }
    justFocusedRef.current = false;
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.blur();
        setIsFocused(false);
        onFocusChangeAction?.(false);
      }
    },
    [onFocusChangeAction],
  );

  const handleSubmit = useCallback(() => {
    setIsFocused(false);
    inputRef.current?.blur();

    const normalized = normalizeDomainInput(value);

    if (!isValidDomain(normalized)) {
      analytics.track("search_invalid_input", { input: value });
      toast.error("Please enter a valid domain.", {
        icon: <IconCircleX className="size-4" />,
        position: "bottom-center",
      });
      inputRef.current?.focus();
      return;
    }

    navigateRef.current(normalized);
  }, [value]);

  return (
    <div className="flex w-full flex-col gap-5">
      <Form aria-label="Domain search" onFormSubmit={handleSubmit}>
        <Field>
          <FieldLabel htmlFor="domain-search" className="sr-only">
            Domain
          </FieldLabel>
          <div className="relative w-full flex-1">
            <InputGroup className={cn(variant === "lg" ? "h-12" : "h-10")}>
              <InputGroupInput
                id="domain-search"
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
                      {isFocused ? "Esc" : `${isMac() ? "⌘" : "Ctrl"}\u00A0K`}
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
      </Form>
    </div>
  );
}
