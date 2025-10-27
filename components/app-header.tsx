import Link from "next/link";
import { UserMenu } from "@/components/auth/user-menu";
import { Bookmarklet } from "@/components/bookmarklet";
import { HeaderSearch } from "@/components/domain/header-search";
import { GithubStars } from "@/components/github-stars";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 grid h-20 grid-cols-[1fr_minmax(0,var(--container-2xl))_1fr] items-center gap-4 border-b bg-background/60 px-4 py-3 backdrop-blur sm:px-6">
      <Link
        href="/"
        className="flex h-14 w-14 items-center justify-self-start rounded-md text-foreground transition-all duration-200 hover:text-muted-foreground active:scale-95"
        aria-label="Go to homepage"
      >
        <Logo className="h-10 w-10" aria-hidden="true" />
      </Link>
      <HeaderSearch />
      <div className="flex h-full items-center gap-1.5 justify-self-end">
        {/* Server-fetched star count with link */}
        <GithubStars />
        {/* The bookmarklet is practially uselesss on mobile */}
        <Separator orientation="vertical" className="!h-4 hidden sm:block" />
        <Bookmarklet className="hidden sm:block" />
        {/* Theme toggle is always shown */}
        <Separator orientation="vertical" className="!h-4" />
        <ThemeToggle />
        {/* User authentication */}
        <Separator orientation="vertical" className="!h-4" />
        <UserMenu />
      </div>
    </header>
  );
}
