"use client";

import type { ComponentProps } from "react";

import { useHaptics } from "@/components/providers/haptics-provider";
import { Button } from "@domainstack/ui/button";
import { ScrollArea } from "@domainstack/ui/scroll-area";
import { cn } from "@domainstack/ui/utils";

export type SuggestionsProps = ComponentProps<typeof ScrollArea>;

export const Suggestions = ({ className, children, ...props }: SuggestionsProps) => (
  <ScrollArea className="w-full" hideScrollbar {...props}>
    <div className={cn("flex w-max items-center gap-2", className)}>{children}</div>
  </ScrollArea>
);

export type SuggestionProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  suggestion: string;
  onClick?: (suggestion: string) => void;
};

export const Suggestion = ({
  suggestion,
  onClick,
  className,
  variant = "outline",
  size = "sm",
  children,
  ...props
}: SuggestionProps) => {
  const { trigger } = useHaptics();

  const handleClick = () => {
    void trigger("light");
    onClick?.(suggestion);
  };

  return (
    <Button
      className={cn("cursor-pointer rounded-lg px-3 text-[13px]", className)}
      onClick={handleClick}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {children || suggestion}
    </Button>
  );
};
