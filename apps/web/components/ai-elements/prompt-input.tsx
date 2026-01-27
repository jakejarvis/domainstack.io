"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@domainstack/ui/input-group";
import { Spinner } from "@domainstack/ui/spinner";
import { IconSend } from "@tabler/icons-react";
import type { ChatStatus } from "ai";
import {
  type ComponentProps,
  type FormEvent,
  type FormEventHandler,
  type HTMLAttributes,
  type KeyboardEventHandler,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// ============================================================================
// PromptInput
// ============================================================================

export type PromptInputMessage = {
  text: string;
};

export type PromptInputProps = Omit<
  HTMLAttributes<HTMLFormElement>,
  "onSubmit"
> & {
  onSubmit: (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>,
  ) => void | Promise<void>;
};

export const PromptInput = ({
  className,
  onSubmit,
  children,
  ...props
}: PromptInputProps) => {
  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    try {
      navigator.vibrate([50]);
    } catch {}

    const form = event.currentTarget;
    const formData = new FormData(form);
    const text = (formData.get("message") as string) || "";

    form.reset();

    try {
      onSubmit({ text }, event);
    } catch (error) {
      console.warn("Message submission failed:", error);
    }
  };

  return (
    <form
      className={cn("w-full", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <InputGroup className="overflow-hidden">{children}</InputGroup>
    </form>
  );
};

// ============================================================================
// PromptInputTextarea
// ============================================================================

export type PromptInputTextareaProps = ComponentProps<
  typeof InputGroupTextarea
>;

export const PromptInputTextarea = ({
  onChange,
  className,
  placeholder = "What would you like to know\u2026",
  ...props
}: PromptInputTextareaProps) => {
  const [isComposing, setIsComposing] = useState(false);

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter") {
      if (isComposing || e.nativeEvent.isComposing) {
        return;
      }
      if (e.shiftKey) {
        return;
      }
      e.preventDefault();

      // Check if the submit button is disabled before submitting
      // biome-ignore lint/nursery/useDestructuring: form needs to be a standalone variable for optional chaining
      const form = e.currentTarget.form;
      const submitButton = form?.querySelector(
        'button[type="submit"]',
      ) as HTMLButtonElement | null;
      if (submitButton?.disabled) {
        return;
      }

      form?.requestSubmit();
    }
  };

  return (
    <InputGroupTextarea
      className={cn("field-sizing-content max-h-48 min-h-12", className)}
      name="message"
      onCompositionEnd={() => setIsComposing(false)}
      onCompositionStart={() => setIsComposing(true)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      onChange={onChange}
      {...props}
    />
  );
};

// ============================================================================
// PromptInputFooter
// ============================================================================

export type PromptInputFooterProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>;

export const PromptInputFooter = ({
  className,
  ...props
}: PromptInputFooterProps) => (
  <InputGroupAddon
    align="block-end"
    className={cn("items-end justify-between gap-1", className)}
    {...props}
  />
);

// ============================================================================
// PromptInputSubmit
// ============================================================================

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatus | "error";
};

/**
 * Submit button for the prompt input.
 *
 * States:
 * - ready: Arrow icon, enabled - submit message
 * - submitted: Spinner icon, disabled - waiting for response
 * - streaming: Spinner icon, disabled - response in progress
 * - error: Arrow icon, enabled - retry sending
 *
 * Note: Stream stopping is not supported when using resumable streams
 * (WorkflowChatTransport with resume: true). The AI SDK docs state that
 * "stream abort functionality is not compatible with stream resumption."
 */
export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon-sm",
  status = "ready",
  disabled,
  children,
  ...props
}: PromptInputSubmitProps) => {
  // Determine icon and aria-label based on status
  let Icon = <IconSend className="size-4" />;
  let ariaLabel = "Send message";

  if (status === "submitted" || status === "streaming") {
    Icon = <Spinner className="size-4" />;
    ariaLabel = status === "submitted" ? "Sending\u2026" : "Generating\u2026";
  }
  // For "ready" and "error", use the default arrow icon (allows retry)

  // Determine if button should be disabled:
  // - submitted/streaming: always disabled (response in progress)
  // - ready/error: respect the disabled prop (typically based on empty input)
  const isDisabled =
    status === "submitted" || status === "streaming" || disabled;

  return (
    <InputGroupButton
      aria-label={ariaLabel}
      className={cn(className)}
      disabled={isDisabled}
      size={size}
      type="submit"
      variant={variant}
      {...props}
    >
      {children ?? Icon}
    </InputGroupButton>
  );
};

// ============================================================================
// PromptInputCharacterCount
// ============================================================================

export type PromptInputCharacterCountProps = HTMLAttributes<HTMLSpanElement> & {
  current: number;
  max: number;
};

export const PromptInputCharacterCount = ({
  current,
  max,
  className,
  ...props
}: PromptInputCharacterCountProps) => (
  <span
    className={cn(
      "text-muted-foreground text-xs tabular-nums",
      current > max && "text-destructive",
      className,
    )}
    {...props}
  >
    {current} / {max}
  </span>
);
