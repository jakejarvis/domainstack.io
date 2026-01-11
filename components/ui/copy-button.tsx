"use client";

import {
  CheckIcon,
  ClipboardTextIcon,
  CopyIcon,
  XCircleIcon,
} from "@phosphor-icons/react/ssr";
import clipboardCopy from "clipboard-copy";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, type buttonVariants } from "@/components/ui/button";
import { cn, type VariantProps } from "@/lib/utils";

type CopyButtonProps = {
  value: string;
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
  // biome-ignore lint/nursery/useConsistentArrowReturn: nesting is intentional
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
      await clipboardCopy(value);

      toast.success("Copied!", {
        icon: <ClipboardTextIcon className="size-4" />,
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
        icon: <XCircleIcon className="size-4" />,
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
      {copied ? (
        <CheckIcon className="size-3.5 text-accent-green" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
      <span className={cn(!showLabel && "sr-only")}>
        {copied ? "Copied" : "Copy"}
      </span>
    </Button>
  );
}
