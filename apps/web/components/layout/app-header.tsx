import { SiGithub } from "@icons-pack/react-simple-icons";
import Link from "next/link";
import { Suspense } from "react";

import { AppHeaderAccount } from "@/components/layout/app-header-account";
import { AppHeaderActions, AppHeaderGrid } from "@/components/layout/app-header-layout";
import { AppHeaderSeparator } from "@/components/layout/app-header-separator";
import { GithubStars } from "@/components/layout/github-stars";
import { MobileSearchProvider } from "@/components/layout/mobile-search-context";
import { MobileSearchToggle } from "@/components/layout/mobile-search-toggle";
import { Logo } from "@/components/logo";
import { HeaderSearchClient } from "@/components/search/header-search-client";
import { HeaderSearchSkeleton } from "@/components/search/header-search-skeleton";
import { Skeleton } from "@domainstack/ui/skeleton";

export function AppHeader() {
  return (
    <MobileSearchProvider>
      <AppHeaderGrid>
        <Link
          href="/"
          className="flex items-center justify-self-start rounded-md p-1 text-foreground transition-[color,transform] duration-200 hover:text-muted-foreground active:scale-95"
          aria-label="Go to homepage"
        >
          <Logo className="size-8" />
        </Link>
        <Suspense fallback={<HeaderSearchSkeleton />}>
          <HeaderSearchClient />
        </Suspense>
        <AppHeaderActions>
          <MobileSearchToggle />
          <Suspense
            fallback={
              <div className="inline-flex h-8 shrink-0 items-center gap-2 px-2.5">
                <SiGithub className="flex size-3.5 shrink-0" aria-hidden="true" />
                <Skeleton className="hidden h-[13px] w-[28px] sm:block" />
              </div>
            }
          >
            <GithubStars />
          </Suspense>
          <AppHeaderSeparator />
          <AppHeaderAccount />
        </AppHeaderActions>
      </AppHeaderGrid>
    </MobileSearchProvider>
  );
}
