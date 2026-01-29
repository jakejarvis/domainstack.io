"use client";

import { Badge } from "@domainstack/ui/badge";
import { CodeBlock } from "@domainstack/ui/code-block";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@domainstack/ui/collapsible";
import { Spinner } from "@domainstack/ui/spinner";
import { cn } from "@domainstack/ui/utils";
import {
  IconCheck,
  IconChevronDown,
  IconCircle,
  IconClock,
  IconTool,
  IconX,
} from "@tabler/icons-react";
import type { ToolUIPart } from "ai";
import type { ComponentProps, ReactNode } from "react";
import { isValidElement } from "react";

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn("w-full rounded-md border border-border", className)}
    {...props}
  />
);

export type ToolHeaderProps = {
  title?: string;
  type: ToolUIPart["type"];
  state: ToolUIPart["state"];
  className?: string;
};

const getStatusBadge = (status: ToolUIPart["state"]) => {
  const labels: Record<string, string> = {
    "input-streaming": "Pending",
    "input-available": "Running",
    "approval-requested": "Awaiting Approval",
    "approval-responded": "Responded",
    "output-available": "Completed",
    "output-error": "Error",
    "output-denied": "Denied",
  };

  const icons: Record<string, ReactNode> = {
    "input-streaming": <IconCircle className="size-4" />,
    "input-available": <Spinner className="size-4" />,
    "approval-requested": <IconClock className="size-4 text-yellow-600" />,
    "approval-responded": <IconCheck className="size-4 text-blue-600" />,
    "output-available": <IconCheck className="size-4 text-green-600" />,
    "output-error": <IconX className="size-4 text-red-600" />,
    "output-denied": <IconX className="size-4 text-orange-600" />,
  };

  return (
    <Badge
      className="gap-1.5 rounded-full py-1 text-xs leading-none"
      variant="secondary"
    >
      {icons[status]}
      {labels[status]}
    </Badge>
  );
};

export const ToolHeader = ({
  className,
  title,
  type,
  state,
  ...props
}: ToolHeaderProps) => (
  <CollapsibleTrigger
    className={cn("group flex w-full items-center gap-3 p-3", className)}
    {...props}
  >
    <IconTool className="size-4 shrink-0 text-muted-foreground" />
    <span className="min-w-0 flex-1 truncate text-left font-medium text-sm">
      {title ?? type.split("-").slice(1).join("-")}
    </span>
    {getStatusBadge(state)}
    <IconChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[open]:rotate-180" />
  </CollapsibleTrigger>
);

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent className={cn(className)} {...props} />
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolUIPart["input"];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => (
  <div
    className={cn("min-w-0 space-y-2 overflow-hidden p-3", className)}
    {...props}
  >
    <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
      Parameters
    </h4>
    <CodeBlock>{JSON.stringify(input, null, 2)}</CodeBlock>
  </div>
);

export type ToolOutputProps = ComponentProps<"div"> & {
  output: ToolUIPart["output"];
  errorText: ToolUIPart["errorText"];
};

/**
 * Unwrap nested output structures from AI SDK.
 * Handles: { type: "tool-result", output: { type: "text", value: "..." } }
 * Returns the innermost value string, or null if not found.
 */
function extractTextValue(value: unknown): string | null {
  if (typeof value !== "object" || value === null || isValidElement(value)) {
    return null;
  }

  // Handle tool-result wrapper: { type: "tool-result", output: ... }
  if ("type" in value && value.type === "tool-result" && "output" in value) {
    return extractTextValue(value.output);
  }

  // Handle text wrapper: { type: "text", value: "..." }
  if (
    "type" in value &&
    value.type === "text" &&
    "value" in value &&
    typeof value.value === "string"
  ) {
    return value.value;
  }

  return null;
}

/**
 * Format a JSON string or object for display, with pretty printing.
 */
function formatJsonValue(value: string): string {
  try {
    const parsed = JSON.parse(value);
    return JSON.stringify(parsed, null, 2);
  } catch {
    // Not valid JSON, return as-is
    return value;
  }
}

/**
 * Extract and format the tool output for display.
 * Handles nested structures like { type: "text", value: "..." } from AI SDK.
 * The text wrapper can appear as either:
 * - An object: { type: "text", value: "..." }
 * - A string: '{"type":"text","value":"..."}'
 */
function formatToolOutput(output: ToolUIPart["output"]): string {
  // Handle text content objects from AI SDK
  const textValue = extractTextValue(output);
  if (textValue !== null) {
    return formatJsonValue(textValue);
  }

  // Handle regular objects
  if (
    typeof output === "object" &&
    output !== null &&
    !isValidElement(output)
  ) {
    return JSON.stringify(output, null, 2);
  }

  // Handle strings - try to parse as JSON for pretty printing
  // Also check if parsed result is a text content wrapper
  if (typeof output === "string") {
    try {
      const parsed = JSON.parse(output);
      // Check if the parsed result is a text content wrapper
      const innerTextValue = extractTextValue(parsed);
      if (innerTextValue !== null) {
        return formatJsonValue(innerTextValue);
      }
      return JSON.stringify(parsed, null, 2);
    } catch {
      return output;
    }
  }

  // Fallback for other types
  return String(output);
}

export const ToolOutput = ({
  className,
  output,
  errorText,
  ...props
}: ToolOutputProps) => {
  // Use explicit null/undefined check to allow falsy values like 0, false, or ""
  if (output == null && !errorText) {
    return null;
  }

  const formattedOutput = output != null ? formatToolOutput(output) : null;

  return (
    <div
      className={cn("min-w-0 space-y-2 overflow-hidden p-3", className)}
      {...props}
    >
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {errorText ? "Error" : "Result"}
      </h4>
      <div
        className={cn(
          "overflow-x-auto text-xs",
          errorText && "bg-destructive/10 text-destructive",
        )}
      >
        {errorText && <div>{errorText}</div>}
        {formattedOutput && (
          <CodeBlock className="max-h-[200px]">{formattedOutput}</CodeBlock>
        )}
      </div>
    </div>
  );
};
