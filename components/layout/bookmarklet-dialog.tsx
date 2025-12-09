"use client";

import {
  Bookmark,
  CornerLeftUp,
  Layers2,
  MousePointerClick,
  Play,
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
import { VideoPlayer, VideoPlayerContent } from "@/components/ui/video-player";
import { cn } from "@/lib/utils";

// retrieve this from the last segment of the icloud.com URL provided when sharing a shortcut
const APPLE_SHORTCUT_ID = "fa17677a0d6440c2a195e608305d6f2b";

interface BookmarkletDialogProps {
  className?: string;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

export function BookmarkletDialog({
  className,
  open,
  onOpenChange,
}: BookmarkletDialogProps) {
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

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        toast.dismiss("bookmarklet-reminder");
      }
      onOpenChange?.(newOpen);
    },
    [onOpenChange],
  );

  // Controlled mode: open/onOpenChange are provided
  const isControlled = open !== undefined;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger className={className} asChild>
          <Button
            aria-label="Open bookmarklet info"
            variant="ghost"
            size="sm"
            className="cursor-pointer"
          >
            <Bookmark />
            <span className="sr-only">Open bookmarklet info</span>
          </Button>
        </DialogTrigger>
      )}

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
          <div className="flex gap-2">
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

            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="lg"
                  className="!px-3 cursor-pointer"
                  aria-label="Watch demo"
                >
                  <Play />
                  <span>Watch Demo</span>
                </Button>
              </DialogTrigger>

              <DialogContent className="max-h-[90vh] overflow-y-auto border-border/80 dark:border-border/50">
                <DialogHeader className="sr-only">
                  <DialogTitle>Shortcut Demo</DialogTitle>
                  <DialogDescription>
                    See how the Apple Shortcut works to inspect domains from
                    Safari.
                  </DialogDescription>
                </DialogHeader>

                <VideoPlayer>
                  <VideoPlayerContent
                    className="h-full object-contain"
                    crossOrigin=""
                    preload="auto"
                    slot="media"
                    src="https://res.cloudinary.com/dhema2uls/video/upload/v1762374050/shortcut_demo_mn2egd.mp4"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                </VideoPlayer>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
