"use client";

import {
  Bookmark,
  ChevronDown,
  CornerLeftUp,
  Layers2,
  MousePointerClick,
  Play,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RaycastIcon } from "@/components/brand-icons";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VideoPlayer, VideoPlayerContent } from "@/components/ui/video-player";
import { useScrollIndicators } from "@/hooks/use-scroll-indicators";
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

function ScrollableContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const { showStart, showEnd, update } = useScrollIndicators({
    containerRef: scrollRef,
    direction: "vertical",
  });

  // Also observe the content wrapper - this catches when children expand/collapse
  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(contentElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [update]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Top scroll shadow */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-black/15 to-transparent transition-opacity duration-200 dark:from-black/40",
          showStart ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      />

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className={cn("min-h-0 flex-1 overflow-y-auto", className)}
      >
        {/* Inner wrapper to observe content height changes (e.g., collapsibles) */}
        <div ref={contentRef}>{children}</div>
      </div>

      {/* Bottom scroll indicator with shadow and chevron */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center transition-opacity duration-200",
          showEnd ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      >
        {/* Gradient shadow */}
        <div className="h-12 w-full bg-gradient-to-t from-black/20 to-transparent dark:from-black/50" />
        {/* Chevron indicator */}
        <div className="absolute bottom-1 flex items-center justify-center">
          <ChevronDown className="size-5 animate-bounce text-muted-foreground/70" />
        </div>
      </div>
    </div>
  );
}

export function BookmarkletDialog({
  className,
  open,
  onOpenChange,
}: BookmarkletDialogProps) {
  // Controlled mode: open/onOpenChange are provided
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);

  const dialogOpen = isControlled ? open : internalOpen;

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
      if (!isControlled) {
        setInternalOpen(newOpen);
      }
      if (!newOpen) {
        toast.dismiss("bookmarklet-reminder");
      }
      onOpenChange?.(newOpen);
    },
    [isControlled, onOpenChange],
  );

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Open bookmarklet info"
                variant="ghost"
                size="sm"
                className={cn("cursor-pointer", className)}
                onClick={() => handleOpenChange(true)}
              >
                <Bookmark />
                <span className="sr-only">Open bookmarklet info</span>
              </Button>
            }
          />
          <TooltipContent>Bookmarklet</TooltipContent>
        </Tooltip>
      )}

      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden border-border/80 p-0 dark:border-border/50">
        <DialogHeader className="shrink-0 p-6 pb-2">
          <DialogTitle className="flex items-center gap-1.5">
            <MousePointerClick className="h-4.5 w-4.5" />
            Bookmarklet
          </DialogTitle>
          <DialogDescription className="sr-only">
            Discover shortcuts to investigate domains from anywhere.
          </DialogDescription>
        </DialogHeader>

        <ScrollableContent className="px-6 pb-6">
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

          <Separator
            aria-hidden="true"
            className="my-3.5 bg-border/80 dark:bg-border/50"
          />

          <Accordion className="w-full">
            <AccordionItem value="apple-shortcut">
              <AccordionTrigger className="-mx-2.5 cursor-pointer rounded-md px-2.5 py-2 hover:bg-muted/50 hover:no-underline [&>svg]:right-2.5">
                <span className="flex items-center gap-2">
                  <Layers2 className="size-4" />
                  <span className="font-semibold leading-none">
                    Apple Shortcut
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="mt-2.5 pb-1">
                <div className="space-y-3.5">
                  <p className="text-muted-foreground text-sm">
                    On Apple devices, add a Shortcut via the button below. An{" "}
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
                      <DialogTrigger
                        render={
                          <Button
                            variant="outline"
                            size="lg"
                            className="!px-3 cursor-pointer"
                            aria-label="Watch demo"
                          >
                            <Play />
                            <span>Watch Demo</span>
                          </Button>
                        }
                      />

                      <DialogContent className="max-h-[90vh] overflow-y-auto border-border/80 dark:border-border/50">
                        <DialogHeader className="sr-only">
                          <DialogTitle>Shortcut Demo</DialogTitle>
                          <DialogDescription>
                            See how the Apple Shortcut works to inspect domains
                            from Safari.
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
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Separator
            aria-hidden="true"
            className="my-3.5 bg-border/80 dark:bg-border/50"
          />

          <Accordion className="w-full">
            <AccordionItem value="raycast" className="border-b-0">
              <AccordionTrigger className="-mx-2.5 cursor-pointer rounded-md px-2.5 py-2 hover:bg-muted/50 hover:no-underline [&>svg]:right-2.5">
                <span className="flex items-center gap-2">
                  <RaycastIcon className="size-4" />
                  <span className="font-semibold leading-none">Raycast</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="mt-2.5 pb-1">
                <div className="space-y-3.5">
                  <p className="text-muted-foreground text-sm">
                    If you&rsquo;re a{" "}
                    <a
                      href="https://www.raycast.com/"
                      target="_blank"
                      rel="noopener"
                      className="font-semibold text-foreground/80 underline underline-offset-3 hover:text-foreground/60"
                    >
                      Raycast
                    </a>{" "}
                    user, add a Quicklink to quickly inspect domains from
                    anywhere. Type{" "}
                    <span className="font-semibold text-foreground/80">
                      &ldquo;domain&rdquo;
                    </span>{" "}
                    followed by a domain name.
                  </p>
                  <a
                    // https://manual.raycast.com/deeplinks
                    href={`raycast://extensions/raycast/raycast/create-quicklink?context=${encodeURIComponent(
                      JSON.stringify({
                        name: "Inspect Domain",
                        link: `${origin}/?q={argument name="domain"}`,
                        icon: "magnifying-glass-16",
                      }),
                    )}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "!px-3",
                    )}
                    data-disable-progress={true}
                  >
                    <RaycastIcon className="h-4 w-4" />
                    <span>Add to Raycast</span>
                  </a>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </ScrollableContent>
      </DialogContent>
    </Dialog>
  );
}
