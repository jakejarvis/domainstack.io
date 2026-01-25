"use client";

import { SiOpenlayers, SiRaycast } from "@icons-pack/react-simple-icons";
import {
  ArrowElbowLeftUpIcon,
  FilmStripIcon,
  MouseLeftClickIcon,
  StackPlusIcon,
} from "@phosphor-icons/react/ssr";
import { toast } from "sonner";
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
import { APPLE_SHORTCUT_ID, BASE_URL } from "@/lib/constants/app";

export function BookmarkletContent() {
  // a little hack to "unsafely" use raw javascript as a link
  const hrefScript = (element: HTMLAnchorElement | null) => {
    if (!element) return;
    const openScript = `var t=window.open("${BASE_URL}/"+location.hostname,"_blank");t.focus()`;
    element.href = `javascript:(function(){${openScript}})();`;
  };

  return (
    <>
      <div className="mb-4 space-y-4">
        <p className="text-muted-foreground text-sm">
          Drag the button below to your bookmarks bar. Then, press it on any
          site and the report for that domain will open in a new tab, like
          magic!
        </p>
        <div className="flex justify-center">
          <Button
            size="lg"
            nativeButton={false}
            // biome-ignore lint/a11y/useValidAnchor: set by hrefScript above
            render={<a ref={hrefScript} />}
            onClick={(e) => {
              e.preventDefault();
              toast.info("Drag the button to your bookmarks bar to use it.", {
                icon: <ArrowElbowLeftUpIcon className="size-4" />,
                position: "top-center",
              });
            }}
          >
            <MouseLeftClickIcon />
            Inspect Domain
          </Button>
        </div>
      </div>

      <Separator className="my-5 bg-border/80 dark:bg-border/50" />

      <Accordion multiple className="w-full rounded-lg border bg-muted/20">
        <AccordionItem
          value="apple-shortcut"
          className="border-border border-b px-4"
        >
          <AccordionTrigger className="text-left decoration-muted-foreground/50 hover:text-foreground/90 hover:underline hover:underline-offset-4">
            <span className="flex items-center gap-2.5">
              <SiOpenlayers className="size-4" />
              <span className="font-semibold leading-none">Apple Shortcut</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pt-1 text-foreground/90">
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
                      <StackPlusIcon />
                      Add Shortcut
                    </a>
                  }
                />

                <Dialog>
                  <DialogTrigger
                    render={
                      <Button variant="outline" aria-label="Watch demo">
                        <FilmStripIcon />
                        Watch Demo
                      </Button>
                    }
                  />

                  <DialogContent className="max-h-[90vh] overflow-y-auto">
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

        <AccordionItem value="raycast" className="border-border border-b px-4">
          <AccordionTrigger className="text-left decoration-muted-foreground/50 hover:text-foreground/90 hover:underline hover:underline-offset-4">
            <span className="flex items-center gap-2.5">
              <SiRaycast className="size-4" />
              <span className="font-semibold leading-none">Raycast</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pt-1 text-foreground/90">
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
                      <SiRaycast />
                      Add to Raycast
                    </a>
                  }
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  );
}
