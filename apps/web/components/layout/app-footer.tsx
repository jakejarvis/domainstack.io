import { IconCookie, IconGavel, IconHeart, IconLifebuoy } from "@tabler/icons-react";
import Link from "next/link";

import { AppFooterIntegrations } from "@/components/layout/app-footer-integrations";

export function AppFooter() {
  return (
    <footer className="space-y-1.5 px-4 pt-6 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center text-xs leading-relaxed text-muted-foreground sm:px-6 [&_a]:inline-flex [&_a]:items-center [&_a]:gap-1 [&_a]:text-foreground/85 [&_a]:hover:text-foreground/60 [&_a]:hover:no-underline [&_svg]:inline-block [&_svg]:size-4 [&_svg]:px-[1px]">
      <div className="flex flex-wrap items-center justify-center space-x-[1.25em] gap-y-2 [&_a]:whitespace-nowrap">
        <Link href="/help">
          <IconLifebuoy className="text-muted-foreground" />
          Help
        </Link>

        <AppFooterIntegrations />

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
        <div className="inline-flex translate-y-[3px] animate-heartbeat motion-reduce:animate-none">
          <IconHeart className="fill-destructive stroke-destructive" />
        </div>{" "}
        by{" "}
        <a href="https://jarv.is/" target="_blank" rel="noopener">
          @jakejarvis
        </a>
      </div>
    </footer>
  );
}
