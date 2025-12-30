import {
  Bookmark,
  Handshake,
  HatGlasses,
  HeartIcon,
  LifeBuoy,
} from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="px-4 pt-6 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center text-muted-foreground text-xs leading-relaxed sm:px-6 [&_a]:inline-flex [&_a]:items-center [&_a]:gap-1 [&_a]:text-foreground/85 [&_a]:hover:text-foreground/60 [&_a]:hover:no-underline [&_svg]:inline-block [&_svg]:size-4 [&_svg]:px-[1px]">
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
          <HeartIcon className="fill-destructive stroke-destructive" />
        </motion.div>{" "}
        by{" "}
        <a href="https://jarv.is/" target="_blank" rel="noopener">
          @jakejarvis
        </a>
        .
      </div>
      <div>
        Brick logo by{" "}
        <a
          href="https://thenounproject.com/creator/arypst/"
          target="_blank"
          rel="noopener"
        >
          Ary Prasetyo
        </a>{" "}
        from{" "}
        <a href="https://thenounproject.com/" target="_blank" rel="noopener">
          Noun Project
        </a>{" "}
        (CC BY 3.0).
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center space-x-[1.25em] [&_a]:whitespace-nowrap">
        <Link href="/help">
          <LifeBuoy className="text-muted-foreground" />
          Help
        </Link>
        <Link href="/bookmarklet">
          <Bookmark className="text-muted-foreground" />
          Bookmarklet
        </Link>
        <Link href="/terms">
          <Handshake className="text-muted-foreground" />
          Terms
        </Link>
        <Link href="/privacy">
          <HatGlasses className="text-muted-foreground" />
          Privacy
        </Link>
      </div>
    </footer>
  );
}
