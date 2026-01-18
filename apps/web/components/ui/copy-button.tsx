"use client";

import {
  CheckIcon,
  ClipboardIcon,
  ClipboardTextIcon,
  XCircleIcon,
} from "@phosphor-icons/react/ssr";
import clipboardCopy from "clipboard-copy";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
  const shouldReduceMotion = useReducedMotion();
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
      <span className="relative flex items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span
              key="check"
              initial={
                shouldReduceMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }
              }
              animate={
                shouldReduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }
              }
              exit={
                shouldReduceMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }
              }
              transition={{ duration: shouldReduceMotion ? 0.1 : 0.15 }}
              className="flex items-center justify-center"
            >
              <CheckIcon className="text-accent-green" />
            </motion.span>
          ) : (
            <motion.span
              key="clipboard"
              initial={
                shouldReduceMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }
              }
              animate={
                shouldReduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }
              }
              exit={
                shouldReduceMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }
              }
              transition={{ duration: shouldReduceMotion ? 0.1 : 0.15 }}
              className="flex items-center justify-center"
            >
              <ClipboardIcon />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span className={cn(!showLabel && "sr-only")}>
        {copied ? "Copied" : "Copy"}
      </span>
    </Button>
  );
}
