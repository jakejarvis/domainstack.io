"use client";

import clipboardCopy from "clipboard-copy";
import { Check, CircleX, ClipboardCheck, Copy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, type buttonVariants } from "@/components/ui/button";
import { cn, type VariantProps } from "@/lib/utils";

type CopyButtonProps = {
  value: string;
  className?: string;
} & VariantProps<typeof buttonVariants>;

export function CopyButton({
  value,
  variant = "ghost",
  size = "icon-sm",
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  // Clear the reset timer on unmount to prevent setState on unmounted component
  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    // Show optimistic feedback immediately - don't wait for clipboard API
    setCopied(true);

    // Clear any existing timer before starting new one
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
    }

    try {
      await clipboardCopy(value);

      toast.success("Copied!", {
        icon: <ClipboardCheck className="size-4" />,
        position: "bottom-center",
      });

      // Start reset timer after successful copy
      resetTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        resetTimerRef.current = null;
      }, 1200);
    } catch {
      // Revert optimistic update on failure
      setCopied(false);
      toast.error("Failed to copy", {
        icon: <CircleX className="size-4" />,
        position: "bottom-center",
      });
    }
  }, [value]);

  return (
    <Button
      variant={variant}
      size={size}
      className={cn("shrink-0", className)}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="size-3.5 text-accent-green" />
      ) : (
        <Copy className="size-3.5" />
      )}
      <span className="sr-only">{copied ? "Copied" : "Copy to clipboard"}</span>
    </Button>
  );
}
