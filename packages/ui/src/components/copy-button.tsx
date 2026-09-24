"use client";

import { IconCheck, IconCircleX, IconClipboardCheck, IconCopy } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { cn, type VariantProps } from "../utils";
import { Button, type buttonVariants } from "./button";

type CopyButtonProps = {
  value: string | (() => string);
  showLabel?: boolean;
  className?: string;
} & VariantProps<typeof buttonVariants>;

export function CopyButton({
  value,
  showLabel = false,
  variant = "ghost",
  size = "icon-sm",
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the reset timer on unmount to prevent setState on unmounted component
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    if (copied) return;

    // Show optimistic feedback immediately - don't wait for clipboard API
    setCopied(true);

    // Clear any existing timer before starting new one
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    try {
      const textToCopy = typeof value === "function" ? value() : value;
      await navigator.clipboard.writeText(textToCopy);

      toast.success("Copied!", {
        icon: <IconClipboardCheck className="size-4" />,
        position: "bottom-center",
      });

      // Start reset timer after successful copy
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
        timeoutRef.current = null;
      }, 3000);
    } catch {
      // Revert optimistic update on failure
      setCopied(false);
      toast.error("Failed to copy", {
        icon: <IconCircleX className="size-4" />,
        position: "bottom-center",
      });
    }
  }, [copied, value]);

  return (
    <Button
      variant={variant}
      size={size}
      className={cn("shrink-0", className, copied && "cursor-default")}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
      onClick={handleCopy}
    >
      <span className="grid place-items-center">
        <span
          className={cn(
            "col-start-1 row-start-1 flex items-center justify-center transition-[opacity,scale] duration-150 ease-out motion-reduce:transition-opacity motion-reduce:duration-100",
            copied
              ? "scale-100 opacity-100 delay-150 motion-reduce:delay-100"
              : "scale-50 opacity-0",
          )}
        >
          <IconCheck className="text-accent-green" />
        </span>
        <span
          className={cn(
            "col-start-1 row-start-1 flex items-center justify-center transition-[opacity,scale] duration-150 ease-out motion-reduce:transition-opacity motion-reduce:duration-100",
            copied
              ? "scale-50 opacity-0"
              : "scale-100 opacity-100 delay-150 motion-reduce:delay-100",
          )}
        >
          <IconCopy />
        </span>
      </span>
      {showLabel && "Copy"}
    </Button>
  );
}
