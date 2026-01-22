"use client";

import { PaperPlaneRightIcon } from "@phosphor-icons/react";
import type { ChatStatus, FileUIPart } from "ai";
import { nanoid } from "nanoid";
import {
  type ClipboardEventHandler,
  type ComponentProps,
  createContext,
  type FormEvent,
  type FormEventHandler,
  type HTMLAttributes,
  type KeyboardEventHandler,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

// ============================================================================
// Internal Attachments Context (used by PromptInputTextarea for paste/backspace)
// ============================================================================

type AttachmentsContext = {
  files: (FileUIPart & { id: string })[];
  add: (files: File[] | FileList) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const LocalAttachmentsContext = createContext<AttachmentsContext | null>(null);

const usePromptInputAttachments = () => {
  const context = useContext(LocalAttachmentsContext);
  if (!context) {
    throw new Error(
      "usePromptInputAttachments must be used within a PromptInput",
    );
  }
  return context;
};

// ============================================================================
// PromptInput
// ============================================================================

export type PromptInputMessage = {
  text: string;
  files: FileUIPart[];
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
  const formRef = useRef<HTMLFormElement | null>(null);

  // Local attachments state (supports paste in textarea)
  const [items, setItems] = useState<(FileUIPart & { id: string })[]>([]);

  const add = useCallback((fileList: File[] | FileList) => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    setItems((prev) =>
      prev.concat(
        incoming.map((file) => ({
          id: nanoid(),
          type: "file" as const,
          url: URL.createObjectURL(file),
          mediaType: file.type,
          filename: file.name,
        })),
      ),
    );
  }, []);

  const remove = useCallback(
    (id: string) =>
      setItems((prev) => {
        const found = prev.find((file) => file.id === id);
        if (found?.url) {
          URL.revokeObjectURL(found.url);
        }
        return prev.filter((file) => file.id !== id);
      }),
    [],
  );

  const clear = useCallback(
    () =>
      setItems((prev) => {
        for (const file of prev) {
          if (file.url) {
            URL.revokeObjectURL(file.url);
          }
        }
        return [];
      }),
    [],
  );

  // Keep a ref for cleanup on unmount
  const filesRef = useRef(items);
  filesRef.current = items;

  useEffect(
    () => () => {
      for (const f of filesRef.current) {
        if (f.url) URL.revokeObjectURL(f.url);
      }
    },
    [],
  );

  const ctx = useMemo<AttachmentsContext>(
    () => ({
      files: items,
      add,
      remove,
      clear,
    }),
    [items, add, remove, clear],
  );

  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const text = (formData.get("message") as string) || "";

    form.reset();

    // Convert blob URLs to data URLs asynchronously
    Promise.all(
      items.map(async ({ id, ...item }) => {
        if (item.url?.startsWith("blob:")) {
          try {
            const response = await fetch(item.url);
            const blob = await response.blob();
            const dataUrl = await new Promise<string | null>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(blob);
            });
            return { ...item, url: dataUrl ?? item.url };
          } catch {
            return item;
          }
        }
        return item;
      }),
    )
      .then((convertedFiles: FileUIPart[]) => {
        try {
          const result = onSubmit({ text, files: convertedFiles }, event);
          if (result instanceof Promise) {
            result
              .then(() => clear())
              .catch((error) =>
                console.warn("Message submission failed:", error),
              );
          } else {
            clear();
          }
        } catch (error) {
          console.warn("Message submission failed:", error);
        }
      })
      .catch((error) => {
        console.warn("Failed to convert attachments:", error);
      });
  };

  return (
    <LocalAttachmentsContext.Provider value={ctx}>
      <form
        className={cn("w-full", className)}
        onSubmit={handleSubmit}
        ref={formRef}
        {...props}
      >
        <InputGroup className="overflow-hidden">{children}</InputGroup>
      </form>
    </LocalAttachmentsContext.Provider>
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
  const attachments = usePromptInputAttachments();
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

    // Remove last attachment when Backspace is pressed and textarea is empty
    if (
      e.key === "Backspace" &&
      e.currentTarget.value === "" &&
      attachments.files.length > 0
    ) {
      e.preventDefault();
      const lastAttachment = attachments.files.at(-1);
      if (lastAttachment) {
        attachments.remove(lastAttachment.id);
      }
    }
  };

  const handlePaste: ClipboardEventHandler<HTMLTextAreaElement> = (event) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      event.preventDefault();
      attachments.add(files);
    }
  };

  return (
    <InputGroupTextarea
      className={cn("field-sizing-content max-h-48 min-h-12", className)}
      name="message"
      onCompositionEnd={() => setIsComposing(false)}
      onCompositionStart={() => setIsComposing(true)}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
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
  let Icon = <PaperPlaneRightIcon className="size-4" />;
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
