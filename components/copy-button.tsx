"use client";

import clipboardCopy from "clipboard-copy";
import { Check, CircleX, ClipboardCheck, Copy } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
}

export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  const handleCopy = async () => {
    try {
      await clipboardCopy(value);

      toast.success("Copied!", {
        icon: <ClipboardCheck className="h-4 w-4" />,
        position: "bottom-center",
      });

      setCopied(true);

      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        resetTimerRef.current = null;
      }, 1200);
    } catch {
      toast.error("Failed to copy", {
        icon: <CircleX className="h-4 w-4" />,
        position: "bottom-center",
      });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        "shrink-0 cursor-pointer border-black/15 bg-background/50 backdrop-blur dark:border-white/10",
        className,
      )}
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="size-3.5 text-accent-green" />
      ) : (
        <Copy className="size-3.5" />
      )}
      <span className="sr-only">{copied ? "Copied" : "Copy"}</span>
    </Button>
  );
}
