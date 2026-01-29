"use client";

import { cn } from "@domainstack/ui/utils";
import type { UIMessage } from "ai";
import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";

export type MessageProps = ComponentProps<"div"> & {
  from: UIMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full flex-col gap-2",
      from === "user"
        ? "is-user ml-auto max-w-[95%] justify-end"
        : "is-assistant",
      className,
    )}
    {...props}
  />
);

export type MessageContentProps = ComponentProps<"div">;

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      "flex w-fit min-w-0 max-w-full flex-col gap-4 overflow-hidden text-sm leading-normal",
      "group-[.is-user]:ml-auto group-[.is-user]:w-fit group-[.is-user]:rounded-lg group-[.is-user]:bg-secondary group-[.is-user]:px-3 group-[.is-user]:py-2 group-[.is-user]:text-foreground",
      "group-[.is-assistant]:w-full group-[.is-assistant]:text-foreground",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageResponseProps = ComponentProps<typeof Streamdown>;

export const MessageResponse = memo(
  ({ className, ...props }: MessageResponseProps) => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        "[&_[data-streamdown=link]]:cursor-pointer [&_[data-streamdown=list-item]]:pl-1 [&_[data-streamdown=ordered-list]]:list-outside [&_[data-streamdown=ordered-list]]:pl-4 [&_[data-streamdown=unordered-list]]:list-outside [&_[data-streamdown=unordered-list]]:pl-4",
        "[&_[data-streamdown=link-safety-modal]]:[&_button]:my-0 [&_[data-streamdown=link-safety-modal]]:[&_button]:cursor-pointer",
        className,
      )}
      caret="block"
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

MessageResponse.displayName = "MessageResponse";
