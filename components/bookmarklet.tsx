"use client";

import {
  Bookmark,
  CornerLeftUp,
  Layers2,
  MousePointerClick,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// retrieve this from the last segment of the icloud.com URL provided when sharing a shortcut
const APPLE_SHORTCUT_ID = "fa17677a0d6440c2a195e608305d6f2b";

export function Bookmarklet({ className }: { className?: string }) {
  // Capture the origin after mount to avoid SSR issues and ensure we have the correct origin
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // a little hack to "unsafely" use raw javascript as a link
  const hrefScript = useCallback(
    (element: HTMLAnchorElement | null) => {
      if (!element || !origin) return;
      const openScript = `var t=window.open("${origin}/"+location.hostname,"_blank");t.focus()`;
      element.href = `javascript:(function(){${openScript}})();`;
    },
    [origin],
  );

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      toast.dismiss("bookmarklet-reminder");
    }
  }, []);

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger className={className} asChild>
        <Button aria-label="Open bookmarklet info" variant="ghost" size="sm">
          <Bookmark />
          <span className="sr-only">Open bookmarklet info</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="border-border/80 dark:border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <MousePointerClick className="h-4.5 w-4.5" />
            Bookmarklet
          </DialogTitle>
          <DialogDescription className="sr-only">
            Discover shortcuts to investigate domains from anywhere.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5">
          <p className="text-muted-foreground text-sm">
            Drag the button below to your bookmarks bar. Then, press it on any
            site and the report for that domain will open in a new tab, like
            magic!
          </p>
          {/** biome-ignore lint/a11y/noStaticElementInteractions: the link is essentially a button */}
          <a
            ref={hrefScript}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "!px-3",
            )}
            // biome-ignore lint/a11y/useValidAnchor: the href is a script, not a valid URL that we want to open now
            onClick={(e) => {
              e.preventDefault();
              toast.info("Drag the button to your bookmarks bar to use it.", {
                icon: <CornerLeftUp className="h-4 w-4" />,
                position: "top-center",
                id: "bookmarklet-reminder",
              });
            }}
          >
            <Bookmark />
            <span>Inspect Domain</span>
          </a>
        </div>

        <Separator className="bg-border/80 dark:bg-border/50" />

        <div className="space-y-3.5">
          <p className="text-muted-foreground text-sm">
            Or, on Apple devices, add a Shortcut via the button below. An{" "}
            <span className="font-semibold text-foreground/80">
              Inspect Domain
            </span>{" "}
            option will now appear when you share a webpage from Safari.
          </p>
          <a
            // https://www.icloud.com/shortcuts/fa17677a0d6440c2a195e608305d6f2b
            href={`workflow://shortcuts/${APPLE_SHORTCUT_ID}`}
            target="_blank"
            rel="noopener"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "!px-3",
            )}
          >
            <Layers2 />
            <span>Add Shortcut</span>
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
