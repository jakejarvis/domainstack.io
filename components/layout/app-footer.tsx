import { Handshake, HatGlasses, LifeBuoy } from "lucide-react";
import Link from "next/link";
import { HeartAnimated } from "@/components/heart";

export function AppFooter() {
  return (
    <footer className="px-4 py-6 text-center text-muted-foreground text-xs leading-relaxed sm:px-6 [&_a]:inline-flex [&_a]:items-center [&_a]:gap-1 [&_a]:text-foreground/85 [&_a]:hover:text-foreground/60 [&_a]:hover:no-underline [&_svg]:inline-block [&_svg]:size-4 [&_svg]:px-[1px] [&_svg]:align-text-bottom">
      <p>
        Made with{" "}
        <HeartAnimated className="fill-destructive stroke-destructive" /> by{" "}
        <a href="https://jarv.is/" target="_blank" rel="noopener">
          @jakejarvis
        </a>
        .
      </p>
      <p>
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
      </p>
      <p className="mt-2 flex flex-wrap items-center justify-center">
        <Link href="/help" prefetch={false}>
          <LifeBuoy className="text-muted-foreground" />
          Help
        </Link>
        <span className="mx-1.5 text-muted-foreground">•</span>
        <Link href="/terms" prefetch={false}>
          <Handshake className="text-muted-foreground" />
          Terms of Service
        </Link>
        <span className="mx-1.5 text-muted-foreground">•</span>
        <Link href="/privacy" prefetch={false}>
          <HatGlasses className="text-muted-foreground" />
          Privacy Policy
        </Link>
      </p>
    </footer>
  );
}
