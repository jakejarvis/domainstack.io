"use client";

import { IconArrowRight, IconCircleX, IconSearch } from "@tabler/icons-react";
import { formatForDisplay, useHotkey } from "@tanstack/react-hotkeys";
import { useAtom } from "jotai";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { useIsClient } from "@/hooks/use-is-client";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRouter } from "@/hooks/use-router";
import { analytics } from "@/lib/analytics/client";
import { pendingDomainAtom } from "@/lib/atoms/search-atoms";
import { safeDecodeURIComponent } from "@/lib/safe-parse";
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
import { isValidDomain, normalizeDomainInput } from "@domainstack/utils/domain/client";

const SEARCH_HOTKEY = "Mod+K";

export type SearchClientVariant = "sm" | "lg";

export type SearchClientProps = {
  variant?: SearchClientVariant;
  initialValue?: string;
  onFocusChangeAction?: (isFocused: boolean) => void;
};

function getRoutePrefill(routeDomain: string | undefined): string {
  if (!routeDomain) return "";
  return safeDecodeURIComponent(routeDomain) ?? "";
}

function getDerivedInitialValue(
  variant: SearchClientVariant,
  routeDomain: string | undefined,
  initialValue: string,
): string {
  const rawInitial = variant === "sm" ? getRoutePrefill(routeDomain) : initialValue;
  const normalizedInitial = normalizeDomainInput(rawInitial);
  return isValidDomain(normalizedInitial) ? normalizedInitial : "";
}

function getSearchPlaceholder(
  variant: SearchClientVariant,
  mounted: boolean,
  isMobile: boolean,
): string {
  if (variant === "lg") return "domainstack.io\u2026";
  if (mounted && isMobile) return "Search\u2026";
  return "Search any domain\u2026";
}

function SearchInputAddons({
  variant,
  loading,
  mounted,
  isFocused,
}: {
  variant: SearchClientVariant;
  loading: boolean;
  mounted: boolean;
  isFocused: boolean;
}) {
  if (variant === "sm" && (loading || mounted)) {
    return (
      <InputGroupAddon align="inline-end">
        {loading ? (
          <Spinner />
        ) : (
          <Kbd className="hidden border bg-muted/80 px-1.5 py-0.5 sm:inline-flex">
            {isFocused ? "Esc" : formatForDisplay(SEARCH_HOTKEY, { separatorToken: "\u00A0" })}
          </Kbd>
        )}
      </InputGroupAddon>
    );
  }

  if (variant === "lg") {
    return (
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          type="submit"
          disabled={loading}
          className="mx-1 h-8 disabled:pointer-events-none"
          variant="ghost"
        >
          {loading ? <Spinner /> : null}
          <div className="flex items-center gap-2">
            <span className="text-[13px]">Inspect</span>
            <Kbd className="hidden text-[13px] sm:inline-flex">⏎</Kbd>
            <IconArrowRight className="inline-flex sm:hidden" aria-hidden />
          </div>
        </InputGroupButton>
      </InputGroupAddon>
    );
  }

  return null;
}

function useSearchClient({
  variant,
  initialValue,
  onFocusChangeAction,
}: Required<Pick<SearchClientProps, "variant" | "initialValue">> &
  Pick<SearchClientProps, "onFocusChangeAction">) {
  const router = useRouter();
  const params = useParams<{ domain?: string }>();
  const isMobile = useIsMobile();
  const [pendingDomain, setPendingDomain] = useAtom(pendingDomainAtom);
  const derivedInitial = getDerivedInitialValue(variant, params.domain, initialValue);

  const [value, setValue] = useState(derivedInitial);
  const [prevDerivedInitial, setPrevDerivedInitial] = useState(derivedInitial);
  const [loading, startNavigation] = useTransition();
  const mounted = useIsClient();
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (derivedInitial !== prevDerivedInitial) {
    setPrevDerivedInitial(derivedInitial);
    setValue(derivedInitial);
  }

  useHotkey(
    SEARCH_HOTKEY,
    () => {
      inputRef.current?.focus();
    },
    { conflictBehavior: "allow" },
  );

  const navigateToDomain = (domain: string) => {
    const target = normalizeDomainInput(domain);
    analytics.track("search_submitted", { domain: target });
    startNavigation(() => router.push(`/${encodeURIComponent(target)}`));
  };

  const navigateRef = useRef(navigateToDomain);
  useEffect(() => {
    navigateRef.current = navigateToDomain;
  });

  if (variant === "lg" && pendingDomain && value !== pendingDomain) {
    setValue(pendingDomain);
  }
  useEffect(() => {
    if (variant === "lg" && pendingDomain) {
      navigateRef.current(pendingDomain);
      setPendingDomain(null);
    }
  }, [variant, pendingDomain, setPendingDomain]);

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

  return {
    variant,
    value,
    setValue,
    loading,
    mounted,
    isMobile,
    isFocused,
    inputRef,
    handlePointerDown,
    handleFocus,
    handleBlur,
    handleClick,
    handleKeyDown,
    handleSubmit,
  };
}

export function SearchClient({
  variant = "lg",
  initialValue = "",
  onFocusChangeAction,
}: SearchClientProps) {
  const {
    value,
    setValue,
    loading,
    mounted,
    isMobile,
    isFocused,
    inputRef,
    handlePointerDown,
    handleFocus,
    handleBlur,
    handleClick,
    handleKeyDown,
    handleSubmit,
  } = useSearchClient({ variant, initialValue, onFocusChangeAction });

  return (
    <div className="flex w-full flex-col gap-5">
      <Form aria-label="Domain search" onFormSubmit={handleSubmit}>
        <Field>
          <FieldLabel className="sr-only">Domain</FieldLabel>
          <div className="relative w-full flex-1">
            <InputGroup className={cn(variant === "lg" ? "h-12" : "h-10")}>
              <InputGroupInput
                ref={inputRef}
                name="domain"
                autoFocus={variant === "lg" && mounted && !isMobile}
                inputMode="url"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={loading}
                placeholder={getSearchPlaceholder(variant, mounted, isMobile)}
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
                <IconSearch aria-hidden />
              </InputGroupAddon>

              <SearchInputAddons
                variant={variant}
                loading={loading}
                mounted={mounted}
                isFocused={isFocused}
              />
            </InputGroup>
          </div>
        </Field>
      </Form>
    </div>
  );
}
