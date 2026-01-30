"use client";

import { APPLE_SHORTCUT_ID } from "@domainstack/constants";
import { Button } from "@domainstack/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@domainstack/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@domainstack/ui/dropdown-menu";
import {
  SiModelcontextprotocol,
  SiRaycast,
} from "@icons-pack/react-simple-icons";
import {
  IconBookmark,
  IconCookie,
  IconCornerLeftUp,
  IconExternalLink,
  IconGavel,
  IconHeart,
  IconLifebuoy,
  IconMouse,
  IconPuzzle,
  IconStackForward,
} from "@tabler/icons-react";
import * as motion from "motion/react-client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { BetaBadge } from "@/components/beta-badge";

export function AppFooter() {
  const [isBookmarkletsOpen, setIsBookmarkletsOpen] = useState(false);
  const handleBookmarkletsOpenChange = (open: boolean) => {
    setIsBookmarkletsOpen(open);
  };
  // a little hack to "unsafely" use raw javascript as a link
  const hrefScript = (element: HTMLAnchorElement | null) => {
    if (!element) return;
    element.href = `javascript:(function(){var t=window.open("${process.env.NEXT_PUBLIC_BASE_URL}/"+location.hostname,"_blank");t.focus()})();`;
  };

  return (
    <>
      <footer className="space-y-1.5 px-4 pt-6 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center text-muted-foreground text-xs leading-relaxed sm:px-6 [&_a]:inline-flex [&_a]:items-center [&_a]:gap-1 [&_a]:text-foreground/85 [&_a]:hover:text-foreground/60 [&_a]:hover:no-underline [&_svg]:inline-block [&_svg]:size-4 [&_svg]:px-[1px]">
        <div className="flex flex-wrap items-center justify-center gap-y-2 space-x-[1.25em] [&_a]:whitespace-nowrap">
          <Link href="/help">
            <IconLifebuoy className="text-muted-foreground" />
            Help
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex cursor-pointer items-center gap-1 text-foreground/85 hover:text-foreground/60">
              <IconPuzzle className="size-4 px-[1px] text-muted-foreground" />
              Integrations
              <BetaBadge className="ml-[1px] px-1.5 py-0 text-[11px] tracking-normal" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="center"
              sideOffset={8}
              className="min-w-44 bg-background ring-0"
            >
              <DropdownMenuItem
                nativeButton={false}
                className="px-1.5 py-1 text-[13px]"
                render={
                  <Link href="/mcp">
                    <SiModelcontextprotocol className="text-muted-foreground" />
                    MCP Server
                  </Link>
                }
              />
              <DropdownMenuItem
                nativeButton={false}
                className="px-1.5 py-1 text-[13px]"
                onClick={() => setIsBookmarkletsOpen(true)}
              >
                <IconBookmark className="text-muted-foreground" />
                Bookmarklet
              </DropdownMenuItem>
              <DropdownMenuItem
                nativeButton={false}
                className="px-1.5 py-1 text-[13px]"
                render={
                  <a
                    // https://www.icloud.com/shortcuts/fa17677a0d6440c2a195e608305d6f2b
                    href={`workflow://shortcuts/${APPLE_SHORTCUT_ID}`}
                    data-disable-progress
                  >
                    <IconStackForward className="text-muted-foreground" />
                    Apple Shortcut
                    <IconExternalLink className="ml-auto size-3.5 translate-y-[-1px] text-muted-foreground" />
                  </a>
                }
              />
              <DropdownMenuItem
                nativeButton={false}
                className="px-1.5 py-1 text-[13px]"
                render={
                  <a
                    href="https://www.raycast.com/jakejarvis/domainstack"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <SiRaycast className="text-muted-foreground" />
                    Raycast (Soon)
                    <IconExternalLink className="ml-auto size-3.5 translate-y-[-1px] text-muted-foreground" />
                  </a>
                }
                disabled
              ></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link href="/terms">
            <IconGavel className="text-muted-foreground" />
            Terms
          </Link>

          <Link href="/privacy">
            <IconCookie className="text-muted-foreground" />
            Privacy
          </Link>
        </div>
        <div>
          Made with{" "}
          <motion.div
            className={"inline-flex translate-y-[3px] will-change-transform"}
            animate={{ scale: [1, 1.15, 1, 1.15, 1, 1] }}
            transition={{
              duration: 1.2,
              repeat: Number.POSITIVE_INFINITY,
              repeatDelay: 0.8,
            }}
          >
            <IconHeart className="fill-destructive stroke-destructive" />
          </motion.div>{" "}
          by{" "}
          <a href="https://jarv.is/" target="_blank" rel="noopener">
            @jakejarvis
          </a>
        </div>
      </footer>

      <Dialog
        open={isBookmarkletsOpen}
        onOpenChange={handleBookmarkletsOpenChange}
      >
        <DialogContent className="!max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 font-medium text-base tracking-tight">
              <IconBookmark className="size-4 text-muted-foreground" />
              Bookmarklet
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Drag the button below to your bookmarks bar. Then, press it on any
            site and the report for that domain will open in a new tab, like
            magic!
          </p>
          <div className="my-2 flex justify-center">
            <Button
              size="lg"
              nativeButton={false}
              // biome-ignore lint/a11y/useValidAnchor: set by hrefScript above
              render={<a ref={hrefScript} />}
              onClick={(e) => {
                e.preventDefault();
                toast.info("Drag the button to your bookmarks bar to use it.", {
                  icon: <IconCornerLeftUp className="size-4" />,
                  position: "top-center",
                });
              }}
            >
              <IconMouse />
              Inspect Domain
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
