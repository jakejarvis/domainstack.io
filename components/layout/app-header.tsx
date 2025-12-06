import Link from "next/link";
import { Suspense } from "react";
import { AuthButton } from "@/components/auth/auth-button";
import { BookmarkletDialog } from "@/components/layout/bookmarklet-dialog";
import { GithubStars } from "@/components/layout/github-stars";
import { GithubStarsSkeleton } from "@/components/layout/github-stars-skeleton";
import { HeaderButtons } from "@/components/layout/header-buttons";
import { HeaderGrid } from "@/components/layout/header-grid";
import { HeaderSearch } from "@/components/layout/header-search";
import { HeaderSearchProvider } from "@/components/layout/header-search-context";
import { HeaderSearchSkeleton } from "@/components/layout/header-search-skeleton";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Logo } from "@/components/logo";
import { Separator } from "@/components/ui/separator";

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
          <HeaderSearch />
        </Suspense>
        <HeaderButtons>
          <Suspense fallback={<GithubStarsSkeleton />}>
            <GithubStars />
          </Suspense>
          {/* Desktop-only: bookmarklet and theme toggle (on mobile, these are in MobileMenu/UserMenu) */}
          <Separator orientation="vertical" className="!h-4 hidden md:block" />
          <BookmarkletDialog className="hidden md:flex" />
          <Separator orientation="vertical" className="!h-4 hidden md:block" />
          <ThemeToggle className="hidden md:flex" />
          <Separator orientation="vertical" className="!h-4" />
          <AuthButton />
        </HeaderButtons>
      </HeaderGrid>
    </HeaderSearchProvider>
  );
}
