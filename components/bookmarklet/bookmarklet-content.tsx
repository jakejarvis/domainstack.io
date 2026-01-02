"use client";

import { Bookmark, Clapperboard, CornerLeftUp, Layers2 } from "lucide-react";
import { toast } from "sonner";
import { RaycastIcon } from "@/components/brand-icons";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
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
import { APPLE_SHORTCUT_ID, BASE_URL } from "@/lib/constants";

export function BookmarkletContent({ className }: { className?: string }) {
  // a little hack to "unsafely" use raw javascript as a link
  const hrefScript = (element: HTMLAnchorElement | null) => {
    if (!element) return;
    const openScript = `var t=window.open("${BASE_URL}/"+location.hostname,"_blank");t.focus()`;
    element.href = `javascript:(function(){${openScript}})();`;
  };

  return (
    <div className={className}>
      <div className="mb-6 space-y-3.5">
        <p className="text-muted-foreground text-sm">
          Drag the button below to your bookmarks bar. Then, press it on any
          site and the report for that domain will open in a new tab, like
          magic!
        </p>
        <div className="flex justify-center">
          <Button
            variant="outline"
            nativeButton={false}
            // biome-ignore lint/a11y/useValidAnchor: set by hrefScript above
            render={<a ref={hrefScript} />}
            onClick={(e) => {
              e.preventDefault();
              toast.info("Drag the button to your bookmarks bar to use it.", {
                icon: <CornerLeftUp className="size-4" />,
                position: "top-center",
              });
            }}
          >
            <Bookmark />
            Inspect Domain
          </Button>
        </div>
      </div>

      <Separator className="my-4 bg-border/80 dark:bg-border/50" />

      <Accordion className="w-full">
        <AccordionItem value="apple-shortcut">
          <AccordionTrigger className="-mx-2.5 cursor-pointer rounded-md px-2.5 py-2 hover:bg-muted/50 hover:no-underline [&>svg]:right-2.5">
            <span className="flex items-center gap-2">
              <Layers2 className="size-4" />
              <span className="font-semibold leading-none">Apple Shortcut</span>
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
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={
                    <a
                      // https://www.icloud.com/shortcuts/fa17677a0d6440c2a195e608305d6f2b
                      href={`workflow://shortcuts/${APPLE_SHORTCUT_ID}`}
                      data-disable-progress
                    >
                      <Layers2 />
                      Add Shortcut
                    </a>
                  }
                />

                <Dialog>
                  <DialogTrigger
                    render={
                      <Button variant="outline" aria-label="Watch demo">
                        <Clapperboard />
                        Watch Demo
                      </Button>
                    }
                  />

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
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Separator className="my-4 bg-border/80 dark:bg-border/50" />

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
                user, add a Quicklink to quickly inspect domains from anywhere.
                Type{" "}
                <span className="font-semibold text-foreground/80">
                  &ldquo;domain&rdquo;
                </span>{" "}
                followed by a domain name.
              </p>
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={
                    // https://manual.raycast.com/deeplinks
                    <a
                      href={`raycast://extensions/raycast/raycast/create-quicklink?context=${encodeURIComponent(
                        JSON.stringify({
                          name: "Inspect Domain",
                          link: `${BASE_URL}/?q={argument name="domain"}`,
                          icon: "magnifying-glass-16",
                        }),
                      )}`}
                      data-disable-progress
                    >
                      <RaycastIcon />
                      Add to Raycast
                    </a>
                  }
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
