import Link from "next/link";
import { Suspense } from "react";
import { AppHeaderClientButtons } from "@/components/layout/app-header-client-buttons";
import { HeaderGrid } from "@/components/layout/app-header-grid";
import { AppHeaderSeparator } from "@/components/layout/app-header-separator";
import { AppHeaderSlideOver } from "@/components/layout/app-header-slideover";
import { GithubStars } from "@/components/layout/github-stars";
import { Logo } from "@/components/logo";
import { HeaderSearchClient } from "@/components/search/header-search-client";
import { HeaderSearchProvider } from "@/components/search/header-search-context";
import { HeaderSearchSkeleton } from "@/components/search/header-search-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export function AppHeader() {
  return (
    <HeaderSearchProvider>
      <HeaderGrid>
        <Link
          href="/"
          className="mr-2.5 flex items-center justify-self-start rounded-md text-foreground transition-[color,transform] duration-200 hover:text-muted-foreground active:scale-95"
          aria-label="Go to homepage"
        >
          <Logo className="h-10 w-10" aria-hidden="true" />
        </Link>
        <Suspense fallback={<HeaderSearchSkeleton />}>
          <HeaderSearchClient />
        </Suspense>
        <AppHeaderSlideOver>
          <Suspense fallback={<Skeleton className="h-8 w-[60px]" />}>
            <GithubStars />
          </Suspense>
          <AppHeaderSeparator />
          <AppHeaderClientButtons />
        </AppHeaderSlideOver>
      </HeaderGrid>
    </HeaderSearchProvider>
  );
}
