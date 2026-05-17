import { router } from "expo-router";
import { Stack } from "expo-router/stack";
import { type AndroidSymbol, unstable_getMaterialSymbolSourceAsync } from "expo-symbols";
import type { ComponentProps } from "react";
import { useEffect, useState } from "react";
import type { ImageSourcePropType } from "react-native";
import { Platform } from "react-native";
import { useCSSVariable } from "uniwind";

import { useSignOut } from "@/hooks/use-sign-out";
import { analytics } from "@/lib/analytics";
import { authClient } from "@/lib/auth";

type MenuActionIcon = ComponentProps<typeof Stack.Toolbar.MenuAction>["icon"];

type IconKey = "account" | "addPerson" | "settings" | "logout" | "logoutDanger";

const ICON_REQUESTS: Array<{ key: IconKey; name: AndroidSymbol; useDangerColor?: boolean }> = [
  { key: "account", name: "account_circle" },
  { key: "addPerson", name: "person_add" },
  { key: "settings", name: "settings" },
  { key: "logout", name: "logout" },
  { key: "logoutDanger", name: "logout", useDangerColor: true },
];

type IconSources = Partial<Record<IconKey, ImageSourcePropType>>;

const iconSourceCache = new Map<string, Promise<IconSources>>();

function loadIconSources(color: string, dangerColor: string): Promise<IconSources> {
  const cacheKey = `${color}|${dangerColor}`;
  const cached = iconSourceCache.get(cacheKey);
  if (cached) return cached;

  const promise = Promise.all(
    ICON_REQUESTS.map(async (request) => {
      const tint = request.useDangerColor ? dangerColor : color;
      const src = await unstable_getMaterialSymbolSourceAsync(request.name, 24, tint);
      return [request.key, src] as const;
    }),
  ).then((entries) => {
    const next: IconSources = {};
    for (const [key, src] of entries) {
      if (src) next[key] = src;
    }
    return next;
  });

  iconSourceCache.set(cacheKey, promise);
  return promise;
}

function useMaterialIconSources(color: string, dangerColor: string): IconSources {
  const [sources, setSources] = useState<IconSources>({});

  useEffect(() => {
    if (Platform.OS !== "android") return;
    let cancelled = false;
    void loadIconSources(color, dangerColor).then((resolved) => {
      if (!cancelled) setSources(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [color, dangerColor]);

  return sources;
}

export function HeaderMenu({
  children,
  leading,
}: {
  children?: React.ReactNode;
  leading?: React.ReactNode;
}) {
  const session = authClient.useSession();
  const user = session.data?.user;
  const isSignedIn = Boolean(user);
  const avatarUri = user?.image ?? null;
  const signOut = useSignOut();
  const iconColor = useCSSVariable("--color-foreground") as string;
  const dangerColor = useCSSVariable("--color-destructive") as string;
  const sources = useMaterialIconSources(iconColor, dangerColor);

  return (
    <Stack.Toolbar placement="right">
      {leading}
      <Stack.Toolbar.Menu accessibilityLabel={isSignedIn ? "Account menu" : "Account"}>
        {avatarUri ? (
          <Stack.Toolbar.Icon renderingMode="original" src={{ uri: avatarUri }} />
        ) : Platform.OS === "ios" ? (
          <Stack.Toolbar.Icon sf={isSignedIn ? "person.crop.circle.fill" : "person.crop.circle"} />
        ) : sources.account ? (
          <Stack.Toolbar.Icon src={sources.account} />
        ) : null}
        {isSignedIn ? (
          <>
            {children}
            <Stack.Toolbar.MenuAction
              icon={Platform.select<MenuActionIcon>({
                ios: "gearshape",
                android: sources.settings,
              })}
              onPress={() => router.push("/settings")}
            >
              Settings
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              destructive
              icon={Platform.select<MenuActionIcon>({
                ios: "rectangle.portrait.and.arrow.right",
                android: sources.logoutDanger ?? sources.logout,
              })}
              onPress={() => {
                analytics.track("sign_out_clicked");
                void signOut().then(() => router.replace("/(tabs)/search"));
              }}
            >
              Sign out
            </Stack.Toolbar.MenuAction>
          </>
        ) : (
          <Stack.Toolbar.MenuAction
            icon={Platform.select<MenuActionIcon>({
              ios: "person.crop.circle.badge.plus",
              android: sources.addPerson,
            })}
            onPress={() => router.push("/sign-in")}
          >
            Sign in
          </Stack.Toolbar.MenuAction>
        )}
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}
