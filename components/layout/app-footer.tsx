import { SiModelcontextprotocol } from "@icons-pack/react-simple-icons";
import {
  BookmarkIcon,
  CookieIcon,
  GavelIcon,
  HeartIcon,
  LifebuoyIcon,
} from "@phosphor-icons/react/ssr";
import * as motion from "motion/react-client";
import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="space-y-1 px-4 pt-6 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center text-muted-foreground text-xs leading-relaxed sm:px-6 [&_a]:inline-flex [&_a]:items-center [&_a]:gap-1 [&_a]:text-foreground/85 [&_a]:hover:text-foreground/60 [&_a]:hover:no-underline [&_svg]:inline-block [&_svg]:size-4 [&_svg]:px-[1px]">
      <div className="flex flex-wrap items-center justify-center space-x-[1.25em] [&_a]:whitespace-nowrap">
        <Link href="/help">
          <LifebuoyIcon className="text-muted-foreground" />
          Help
        </Link>
        <Link href="/mcp">
          <SiModelcontextprotocol className="text-muted-foreground" />
          MCP
        </Link>
        <Link href="/bookmarklet">
          <BookmarkIcon className="text-muted-foreground" />
          Bookmarklet
        </Link>
        <Link href="/terms">
          <GavelIcon className="text-muted-foreground" />
          Terms
        </Link>
        <Link href="/privacy">
          <CookieIcon className="text-muted-foreground" />
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
          <HeartIcon
            className="fill-destructive stroke-destructive"
            weight="fill"
          />
        </motion.div>{" "}
        by{" "}
        <a href="https://jarv.is/" target="_blank" rel="noopener">
          @jakejarvis
        </a>
      </div>
    </footer>
  );
}
