import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { BookmarkletDialog } from "@/components/layout/bookmarklet-dialog";
import { GithubStars } from "@/components/layout/github-stars";
import { GithubStarsSkeleton } from "@/components/layout/github-stars-skeleton";
import { HeaderButtons } from "@/components/layout/header-buttons";
import { HeaderGrid } from "@/components/layout/header-grid";
import { HeaderSearch } from "@/components/layout/header-search";
import { HeaderSearchProvider } from "@/components/layout/header-search-context";
import { HeaderSearchSkeleton } from "@/components/layout/header-search-skeleton";
import { SignInButton } from "@/components/layout/sign-in-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Logo } from "@/components/logo";
import { Separator } from "@/components/ui/separator";
import { auth } from "@/lib/auth";

export async function AppHeader() {
  // Fetch session server-side
  let session = null;
  try {
    const headerList = await headers();
    session = await auth.api.getSession({ headers: headerList });
  } catch {
    // Ignore auth errors
  }

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
          <Separator orientation="vertical" className="!h-4" />
          <BookmarkletDialog />
          <Separator orientation="vertical" className="!h-4" />
          <ThemeToggle />
          {session?.user ? (
            <>
              <Separator orientation="vertical" className="!h-4" />
              <UserMenu user={session.user} />
            </>
          ) : (
            <>
              <Separator orientation="vertical" className="!h-4" />
              <SignInButton />
            </>
          )}
        </HeaderButtons>
      </HeaderGrid>
    </HeaderSearchProvider>
  );
}
