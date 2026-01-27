import { SiGithub } from "@icons-pack/react-simple-icons";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeaderClientButtons } from "@/components/layout/app-header-client-buttons";
import { AppHeaderGrid } from "@/components/layout/app-header-grid";
import { AppHeaderSeparator } from "@/components/layout/app-header-separator";
import { AppHeaderSlideOver } from "@/components/layout/app-header-slideover";
import { GithubStars } from "@/components/layout/github-stars";
import { Logo } from "@/components/logo";
import { HeaderSearchClient } from "@/components/search/header-search-client";
import { HeaderSearchSkeleton } from "@/components/search/header-search-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export function AppHeader() {
  return (
    <AppHeaderGrid>
      <Link
        href="/"
        className="mr-1 flex items-center justify-self-start rounded-md text-foreground transition-[color,transform] duration-200 hover:text-muted-foreground active:scale-95"
        aria-label="Go to homepage"
      >
        <Logo className="size-8" />
      </Link>
      <Suspense fallback={<HeaderSearchSkeleton />}>
        <HeaderSearchClient />
      </Suspense>
      <AppHeaderSlideOver>
        <Suspense
          fallback={
            <div className="mr-1.5 ml-2.5 inline-flex shrink-0 items-center gap-2">
              <SiGithub className="flex size-3.5 shrink-0" aria-hidden="true" />
              <Skeleton className="h-[15px] w-[28px]" />
            </div>
          }
        >
          <GithubStars />
        </Suspense>
        <AppHeaderSeparator />
        <AppHeaderClientButtons />
      </AppHeaderSlideOver>
    </AppHeaderGrid>
  );
}
