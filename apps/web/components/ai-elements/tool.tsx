"use client";

import {
  CaretDownIcon,
  CheckCircleIcon,
  CircleIcon,
  ClockIcon,
  WrenchIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import type { ToolUIPart } from "ai";
import type { ComponentProps, ReactNode } from "react";
import { isValidElement } from "react";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/ui/code-block";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn(
      "not-prose mb-4 w-full rounded-md border border-border",
      className,
    )}
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
    "input-streaming": <CircleIcon className="size-4" />,
    "input-available": <Spinner className="size-4" />,
    "approval-requested": <ClockIcon className="size-4 text-yellow-600" />,
    "approval-responded": <CheckCircleIcon className="size-4 text-blue-600" />,
    "output-available": <CheckCircleIcon className="size-4 text-green-600" />,
    "output-error": <XCircleIcon className="size-4 text-red-600" />,
    "output-denied": <XCircleIcon className="size-4 text-orange-600" />,
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
    <WrenchIcon className="size-4 shrink-0 text-muted-foreground" />
    <span className="min-w-0 flex-1 truncate text-left font-medium text-sm">
      {title ?? type.split("-").slice(1).join("-")}
    </span>
    {getStatusBadge(state)}
    <CaretDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[open]:rotate-180" />
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
    className={cn("min-w-0 space-y-2 overflow-hidden p-4", className)}
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
 * Extract and format the tool output for display.
 * Handles nested structures like { type: "text", value: "..." } from AI SDK.
 */
function formatToolOutput(output: ToolUIPart["output"]): string {
  // Handle text content objects from AI SDK
  if (
    typeof output === "object" &&
    output !== null &&
    !isValidElement(output) &&
    "type" in output &&
    output.type === "text" &&
    "value" in output &&
    typeof output.value === "string"
  ) {
    // Try to parse the value as JSON for pretty printing
    try {
      const parsed = JSON.parse(output.value);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // Not valid JSON, return as-is
      return output.value;
    }
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
  if (typeof output === "string") {
    try {
      const parsed = JSON.parse(output);
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
      className={cn("min-w-0 space-y-2 overflow-hidden p-4", className)}
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
        {formattedOutput && <CodeBlock>{formattedOutput}</CodeBlock>}
      </div>
    </div>
  );
};
