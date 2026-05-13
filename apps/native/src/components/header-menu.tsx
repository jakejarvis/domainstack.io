import { router } from "expo-router";
import { Stack } from "expo-router/stack";

import { authClient, signOut } from "@/lib/auth";

export function HeaderMenu() {
  const session = authClient.useSession();
  const user = session.data?.user;
  const isSignedIn = Boolean(user);
  const avatarUri = user?.image ?? null;

  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu accessibilityLabel={isSignedIn ? "Account menu" : "Account"}>
        {avatarUri ? (
          <Stack.Toolbar.Icon renderingMode="original" src={{ uri: avatarUri }} />
        ) : (
          <Stack.Toolbar.Icon sf={isSignedIn ? "person.crop.circle.fill" : "person.crop.circle"} />
        )}
        {isSignedIn ? (
          <>
            <Stack.Toolbar.MenuAction icon="gearshape" onPress={() => router.push("/settings")}>
              Settings
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              destructive
              icon="rectangle.portrait.and.arrow.right"
              onPress={() => {
                void signOut().then(() => router.replace("/(tabs)/search"));
              }}
            >
              Sign out
            </Stack.Toolbar.MenuAction>
          </>
        ) : (
          <Stack.Toolbar.MenuAction
            icon="person.crop.circle.badge.plus"
            onPress={() => router.push("/sign-in")}
          >
            Sign in
          </Stack.Toolbar.MenuAction>
        )}
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}
