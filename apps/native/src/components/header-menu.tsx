import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { Stack } from "expo-router/stack";
import type { ComponentProps } from "react";
import { useEffect, useState } from "react";
import type { ImageSourcePropType } from "react-native";
import { Platform } from "react-native";

import { analytics } from "@/lib/analytics";
import { authClient, signOut } from "@/lib/auth";
import { useCSSVariable } from "@/tw";

type MenuActionIcon = ComponentProps<typeof Stack.Toolbar.MenuAction>["icon"];

type MaterialName = keyof typeof MaterialIcons.glyphMap;
type IconKey = "account" | "addPerson" | "settings" | "logout" | "logoutDanger";

const ICON_REQUESTS: Array<{ key: IconKey; name: MaterialName; useDangerColor?: boolean }> = [
  { key: "account", name: "account-circle" },
  { key: "addPerson", name: "person-add" },
  { key: "settings", name: "settings" },
  { key: "logout", name: "logout" },
  { key: "logoutDanger", name: "logout", useDangerColor: true },
];

function useMaterialIconSources(
  color: string,
  dangerColor: string,
): Partial<Record<IconKey, ImageSourcePropType>> {
  const [sources, setSources] = useState<Partial<Record<IconKey, ImageSourcePropType>>>({});

  useEffect(() => {
    if (Platform.OS !== "android") return;
    let cancelled = false;

    void Promise.all(
      ICON_REQUESTS.map(async (request) => {
        const tint = request.useDangerColor ? dangerColor : color;
        const src = await MaterialIcons.getImageSource(request.name, 24, tint);
        return [request.key, src] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      const next: Partial<Record<IconKey, ImageSourcePropType>> = {};
      for (const [key, src] of entries) {
        if (src) next[key] = src;
      }
      setSources(next);
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
  const iconColor = useCSSVariable("--color-text-primary");
  const dangerColor = useCSSVariable("--color-danger");
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
