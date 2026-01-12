"use client";

import {
  FadersHorizontalIcon,
  LayoutIcon,
  MoonIcon,
  SignOutIcon,
  SunIcon,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "@/hooks/use-router";
import { useTheme } from "@/hooks/use-theme";
import { useAnalytics } from "@/lib/analytics/client";
import { signOut, useSession } from "@/lib/auth-client";

export function UserMenu() {
  const router = useRouter();
  const analytics = useAnalytics();
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();

  if (!session?.user) {
    return null;
  }

  const { user } = session;
  const avatarUrl = `/api/avatar/${user.id}`;
  const initials =
    (user.name || "")
      .split(" ")
      .filter((n) => n.length > 0)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  const handleSignOut = async () => {
    analytics.track("sign_out_clicked");
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            // Reset PostHog identity to prevent event crossover between users
            analytics.reset();
            router.push("/");
          },
        },
      });
    } catch {
      // Sign-out failure is rare; user sees they're still logged in
    }
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full px-0 py-0 hover:bg-transparent active:scale-95 dark:hover:bg-transparent"
            aria-label="User menu"
          >
            <Avatar className="size-8">
              <AvatarImage src={avatarUrl} alt={user.name} size={32} />
              <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-2">
            <Avatar className="size-8">
              <AvatarImage src={avatarUrl} alt={user.name} size={32} />
              <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col space-y-1">
              <p className="font-medium text-sm leading-none">
                {user.name || "User"}
              </p>
              <p className="text-muted-foreground text-xs leading-none">
                {user.email}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          nativeButton={false}
          render={
            <Link href="/dashboard">
              <LayoutIcon weight="bold" />
              Dashboard
            </Link>
          }
        />
        <DropdownMenuItem
          nativeButton={false}
          render={
            <Link href="/settings" scroll={false}>
              <FadersHorizontalIcon weight="bold" />
              Settings
            </Link>
          }
        />
        <DropdownMenuSeparator />
        {/* Theme toggle and bookmarklet - now visible on all screen sizes */}
        <DropdownMenuItem className="cursor-pointer" onClick={toggleTheme}>
          {theme === "dark" ? (
            <SunIcon weight="bold" />
          ) : (
            <MoonIcon weight="bold" />
          )}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onClick={handleSignOut}>
          <SignOutIcon weight="bold" className="text-danger-foreground" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
