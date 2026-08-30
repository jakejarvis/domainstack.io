"use client";

import { IconCheck, IconCircleX, IconClipboardCheck, IconCopy } from "@tabler/icons-react";
import clipboardCopy from "clipboard-copy";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
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
  const shouldReduceMotion = useReducedMotion();
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
      await clipboardCopy(textToCopy);

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
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <m.span
            key="check"
            initial={shouldReduceMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0.1 : 0.15 }}
            className="flex items-center justify-center"
          >
            <IconCheck className="text-accent-green" />
          </m.span>
        ) : (
          <m.span
            key="clipboard"
            initial={shouldReduceMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0.1 : 0.15 }}
            className="flex items-center justify-center"
          >
            <IconCopy />
          </m.span>
        )}
      </AnimatePresence>
      {showLabel && "Copy"}
    </Button>
  );
}
