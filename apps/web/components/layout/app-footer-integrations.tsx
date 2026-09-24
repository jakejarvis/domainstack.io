"use client";

import { SiModelcontextprotocol, SiRaycast } from "@icons-pack/react-simple-icons";
import {
  IconBookmark,
  IconBookmarks,
  IconBrandApple,
  IconCornerLeftUp,
  IconExternalLink,
  IconPuzzle,
  IconWorld,
} from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { BetaBadge } from "@/components/beta-badge";
import { APPLE_SHORTCUT_ID } from "@domainstack/constants";
import { Button } from "@domainstack/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@domainstack/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@domainstack/ui/dropdown-menu";

// a little hack to "unsafely" use raw javascript as a link
function hrefScript(element: HTMLAnchorElement | null) {
  if (!element) return;
  element.href = `javascript:(function(){var t=window.open("${process.env.NEXT_PUBLIC_BASE_URL}/"+location.hostname,"_blank");t.focus()})();`;
}

function handleInspectDomainClick(e: React.MouseEvent) {
  e.preventDefault();
  toast.info("Drag the button to your bookmarks bar to use it.", {
    icon: <IconCornerLeftUp className="size-4" />,
    position: "top-center",
  });
}

/**
 * Footer "Integrations" menu and the bookmarklet dialog it opens — the only
 * interactive part of the otherwise server-rendered footer.
 */
export function AppFooterIntegrations() {
  const [isBookmarkletsOpen, setIsBookmarkletsOpen] = useState(false);

  return (
    <>
      <DropdownMenu modal={false}>
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
            <IconBookmarks className="text-muted-foreground" />
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
                <IconBrandApple className="text-muted-foreground" />
                Shortcut
                <IconExternalLink className="ml-auto size-3.5 translate-y-[-1px] text-muted-foreground" />
              </a>
            }
          />
          <DropdownMenuItem
            nativeButton={false}
            className="px-1.5 py-1 text-[13px]"
            render={
              <span>
                <SiRaycast className="text-muted-foreground" />
                Raycast (soon)
                <IconExternalLink className="ml-auto size-3.5 translate-y-[-1px] text-muted-foreground" />
              </span>
            }
            disabled
          ></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isBookmarkletsOpen} onOpenChange={setIsBookmarkletsOpen}>
        <DialogContent className="!max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-base font-medium tracking-tight">
              <IconBookmark className="size-4 text-muted-foreground" />
              Bookmarklet
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Drag the button below to your bookmarks bar. Then, press it on any site and the report
            for that domain will open in a new tab, like magic!
          </p>
          <div className="my-2 flex justify-center">
            <Button
              size="lg"
              nativeButton={false}
              aria-label="Inspect Domain"
              render={
                // Bookmarklet drag target; href is filled in on mount.
                // oxlint-disable-next-line jsx-a11y/anchor-is-valid
                <a ref={hrefScript} href="#">
                  <IconWorld />
                  Inspect Domain
                </a>
              }
              onClick={handleInspectDomainClick}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
