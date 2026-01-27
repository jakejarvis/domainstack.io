"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@domainstack/ui/avatar";
import { Button } from "@domainstack/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@domainstack/ui/dropdown-menu";
import {
  IconLayoutDashboard,
  IconLogout,
  IconMoon,
  IconSettings,
  IconSun,
} from "@tabler/icons-react";
import { getImageProps } from "next/image";
import Link from "next/link";
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
  const { props: imageProps } = getImageProps({
    src: avatarUrl as string,
    alt: user.name ?? "User avatar",
    width: 32,
    height: 32,
    loading: "eager",
    draggable: false,
  });
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
              <AvatarImage {...imageProps} />
              <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-56">
        <div className="flex select-none items-center gap-[9px] p-1.5">
          <Avatar className="size-8">
            <AvatarImage {...imageProps} />
            <AvatarFallback className="bg-muted text-muted-foreground text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col space-y-[5px]">
            <p className="font-medium text-sm leading-none">
              {user.name || "User"}
            </p>
            <p className="text-muted-foreground text-xs leading-none">
              {user.email}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          nativeButton={false}
          render={
            <Link href="/dashboard">
              <IconLayoutDashboard />
              Dashboard
            </Link>
          }
        />
        <DropdownMenuItem
          nativeButton={false}
          render={
            <Link href="/settings" scroll={false}>
              <IconSettings />
              Settings
            </Link>
          }
        />
        <DropdownMenuSeparator />
        {/* Theme toggle and bookmarklet - now visible on all screen sizes */}
        <DropdownMenuItem onClick={toggleTheme}>
          {theme === "dark" ? <IconSun /> : <IconMoon />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <IconLogout className="text-danger-foreground" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
